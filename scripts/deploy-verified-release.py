#!/usr/bin/env python3
"""Build published Git source separately, then activate the verified commit.

Never reset/clean the live checkout or run database schema changes. A dirty
VPS checkout must be preserved explicitly before its fast-forward update.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import time
import urllib.error
import urllib.request

ROOT = Path('/var/www/ClassA-Store')
PM2 = 'AClassStore'

def ensure(condition, message):
    if not condition:
        raise RuntimeError(message)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def dirty_paths():
    entries = subprocess.check_output(['git', 'status', '--porcelain', '-z', '--untracked-files=all'], cwd=ROOT).split(b'\0')
    result=[]
    for item in entries:
        if not item:
            continue
        status, name = item[:2].decode(), item[3:].decode()
        ensure('R' not in status and 'C' not in status, 'Review renamed paths before deploying')
        if not name.startswith('logs/') and name != 'ngrok.log':
            result.append(name)
    return sorted(result)

def checkout_fingerprint():
    names=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=ROOT).split(b'\0')
    files={}
    for raw in names:
        if not raw:
            continue
        name=raw.decode()
        if name.startswith('logs/') or name=='ngrok.log':
            continue
        path=ROOT/name
        data=os.readlink(path).encode() if path.is_symlink() else path.read_bytes() if path.is_file() else b'<absent>'
        files[name]=digest(data)
    files['.env']=digest((ROOT/'.env').read_bytes())
    return files

def served_fingerprint(directory, baseline=None):
    paths=[]
    for name in ['app','components','lib','messages','i18n','worker']:
        paths += [p for p in (directory/name).rglob('*') if p.is_file()]
    paths += [directory/name for name in ['package.json','package-lock.json','next.config.ts','proxy.ts','prisma/schema.prisma']]
    result={}
    for path in paths:
        name=path.relative_to(directory).as_posix()
        data=path.read_bytes().replace(b'\r\n',b'\n')
        if baseline:
            expected=subprocess.check_output(['git','show',baseline+':'+name],cwd=ROOT)
            ensure(expected.replace(b'\r\n',b'\n')==data,'Served source differs from recorded Git baseline: '+name)
        result[name]=digest(data)
    return result

def run(*args, cwd=ROOT, **kwargs):
    return subprocess.run(args, cwd=cwd, check=True, **kwargs)

def git(*args, cwd=ROOT):
    return subprocess.check_output(['git', *args], cwd=cwd, text=True).strip()

def same_file(left, right):
    return left.is_file() and right.is_file() and left.read_bytes().replace(b'\r\n', b'\n') == right.read_bytes().replace(b'\r\n', b'\n')

def stamp():
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')

def write_json(file, value):
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(value, indent=2) + '\n')
    os.chmod(file, 0o600)

def prepare(commit, font_cache, baseline):
    initial_head=git('rev-parse','HEAD')
    run('git', 'fetch', 'origin', 'main')
    target = git('rev-parse', commit + '^{commit}')
    ensure(target == git('rev-parse', 'origin/main'), 'Requested commit must match the latest published main')
    previous = (ROOT / '.next').resolve()
    ensure((ROOT/'.next').is_symlink(), 'Live .next must be a symlink; no live files were changed')
    ensure(baseline is not None, 'Provide the Git commit recording the currently served source')
    run('git','merge-base','--is-ancestor',baseline,target)
    live_source=served_fingerprint(previous.parent,baseline)
    reviewed_checkout=checkout_fingerprint()
    reviewed_paths=dirty_paths()
    release = ROOT.parent / (ROOT.name + '-release-' + target[:12] + '-' + stamp())
    origin = git('remote', 'get-url', 'origin')
    run('git', 'clone', '--quiet', '--no-checkout', '--single-branch', '--branch', 'main', '--', origin, str(release))
    run('git', 'checkout', '--quiet', '--detach', target, cwd=release)
    ensure(git('rev-parse', 'HEAD', cwd=release) == target,'Checkout differs from requested commit')
    shutil.copy2(ROOT / '.env', release / '.env')
    os.chmod(release / '.env', 0o600)
    ensure(all(same_file(release/name,previous.parent/name) for name in ['package.json','package-lock.json','prisma/schema.prisma']), 'This deployment path does not support dependency/schema changes')
    ensure(same_file(ROOT/'package.json',release/'package.json') and same_file(ROOT/'package-lock.json',release/'package-lock.json'), 'Live launcher dependencies differ from the release')
    (release / 'node_modules').symlink_to((previous.parent / 'node_modules').resolve(), target_is_directory=True)
    private = release / '.deploy'
    private.mkdir(mode=0o700)
    env = os.environ.copy()
    env['NEXT_PUBLIC_BUILD_COMMIT']=target
    cache = Path(font_cache) if font_cache else previous.parent / '.deploy/font-cache.cjs'
    if cache.is_file():
        shutil.copy2(cache, private / 'font-cache.cjs')
        env['NEXT_FONT_GOOGLE_MOCKED_RESPONSES'] = str(private / 'font-cache.cjs')
    with (private / 'build.log').open('w') as log:
        run('npm', 'run', 'build', '--', '--webpack', cwd=release, env=env, stdout=log, stderr=subprocess.STDOUT)
    ensure(not git('status', '--porcelain', cwd=release), 'Build modified versioned source')
    ensure(git('rev-parse','HEAD')==initial_head,'VPS HEAD changed while preparing')
    previous_version=json.loads((previous/'release-info.json').read_text()).get('commit') if (previous/'release-info.json').is_file() else None
    info = dict(commit=target, tree=git('rev-parse', 'HEAD^{tree}', cwd=release), release=str(release), previousHead=initial_head, previousNext=str(previous), previousVersion=previous_version, baseline=baseline, servedSource=live_source, reviewedCheckout=reviewed_checkout, reviewedPaths=reviewed_paths, createdAt=stamp())
    write_json(private / 'release.json', info)
    write_json(release / '.next/release-info.json', info)
    print(json.dumps(dict(commit=target,release=str(release),reviewedPaths=len(reviewed_paths),servedSourceFiles=len(live_source))))

def switch_build(target):
    link = ROOT / '.next.pending-release'
    ensure((ROOT/'.next').is_symlink(), 'Live build pointer changed type')
    ensure(not link.exists() and not link.is_symlink(), 'Pending release pointer already exists')
    link.symlink_to(target, target_is_directory=True)
    try:
        os.replace(link, ROOT / '.next')
    except BaseException:
        link.unlink(missing_ok=True)
        raise

def status_code(path):
    try:
        return urllib.request.urlopen('http://127.0.0.1:3000' + path, timeout=10).status
    except urllib.error.HTTPError as error:
        return error.code

def responding_version():
    try:
        with urllib.request.urlopen('http://127.0.0.1:3000/api/deployment-version',timeout=10) as response:
            return json.load(response).get('commit')
    except urllib.error.HTTPError as error:
        if error.code==404:
            return None
        raise

def rollback(info,backup):
    errors=[]
    def attempt(label,action):
        try:
            action()
        except BaseException as error:
            errors.append(label+': '+str(error))
    attempt('stop',lambda:run('pm2','stop',PM2,stdout=subprocess.DEVNULL))
    def restore_git():
        if git('rev-parse','HEAD')!=info['previousHead']:
            run('git','switch','--detach',info['previousHead'])
        current_main=git('rev-parse','refs/heads/main')
        if current_main==info['commit']:
            run('git','update-ref','refs/heads/main',info['previousHead'],info['commit'])
        else:
            ensure(current_main==info['previousHead'],'main changed independently; refusing to overwrite it')
        run('git','switch','main')
        if info.get('preservedStash'):
            run('git','stash','apply','--index',info['preservedStash'])
    attempt('restore Git and staged edits',restore_git)
    # Serving-pointer recovery must run even when Git/stash recovery fails.
    attempt('restore previous build',lambda:switch_build(Path(info['previousNext'])))
    attempt('restart',lambda:run('pm2','restart',PM2,'--update-env',stdout=subprocess.DEVNULL))
    healthy=False
    for iteration in range(25):
        try:
            healthy=status_code('/th')==200 and responding_version()==info.get('previousVersion')
            if healthy:
                break
        except (OSError,urllib.error.URLError,ValueError):
            pass
        time.sleep(1)
    if not healthy:
        errors.append('previous website health/version verification failed')
    attempt('verify restored source',lambda:ensure(checkout_fingerprint()==info['reviewedCheckout'],'restored files differ'))
    info['rolledBackBuildAndSource']=not errors
    info['rollbackErrors']=errors
    write_json(backup/'release.json',info)
    ensure(not errors,'Rollback needs attention; preserved data is in '+str(backup)+': '+'; '.join(errors))

def activate_locked(release_path, preserve):
    release = Path(release_path).resolve()
    ensure(release.parent == ROOT.parent and release.name.startswith(ROOT.name + '-release-'),'Invalid release path')
    info = json.loads((release / '.deploy/release.json').read_text())
    target = info['commit']
    run('git', 'fetch', 'origin', 'main')
    ensure(target == git('rev-parse', 'origin/main'), 'Published main changed after this build; prepare the current commit')
    ensure(target == git('rev-parse', 'HEAD', cwd=release) and not git('status', '--porcelain', cwd=release),'Prepared checkout changed')
    ensure(info['previousNext'] == str((ROOT / '.next').resolve()), 'Currently served build changed while preparing')
    ensure((ROOT/'.next').is_symlink() and not (ROOT/'.next.pending-release').exists() and not (ROOT/'.next.pending-release').is_symlink(),'Build pointer preflight failed')
    ensure(served_fingerprint(Path(info['previousNext']).parent)==info['servedSource'],'Served source changed after review')
    ensure(checkout_fingerprint()==info['reviewedCheckout'] and dirty_paths()==info['reviewedPaths'],'VPS files changed after review; reconcile them before deploying')
    ensure(git('rev-parse','HEAD')==info['previousHead'],'VPS HEAD changed after preparation')
    ensure(git('branch', '--show-current') == 'main', 'Live checkout must be on main')
    run('git', 'merge-base', '--is-ancestor', git('rev-parse', 'HEAD'), target)
    dirty = git('status', '--porcelain')
    ensure(not dirty or preserve, 'VPS edits exist: preserve/reconcile them before deployment')
    backup = ROOT.parent / (ROOT.name + '-backup-' + stamp())
    backup.mkdir(mode=0o700)
    with tarfile.open(backup / 'checkout.tar.gz', 'w:gz') as archive:
        for child in ROOT.iterdir():
            if child.name not in {'.git', 'node_modules', '.next'}:
                archive.add(child, arcname=child.name)
    os.chmod(backup / 'checkout.tar.gz', 0o600)
    info.update(backup=str(backup), previousStatus=dirty)
    write_json(backup / 'release.json', info)
    # Keep cached pages' immutable assets available across the release switch.
    old_static = Path(info['previousNext']) / 'static'
    for source in old_static.rglob('*'):
        if not source.is_file():
            continue
        destination = release / '.next/static' / source.relative_to(old_static)
        if not destination.exists():
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
    try:
        ensure(checkout_fingerprint()==info['reviewedCheckout'],'VPS files changed while backing up')
        run('pm2', 'stop', PM2, stdout=subprocess.DEVNULL)
        if info['reviewedPaths']:
            run('git','--literal-pathspecs','stash','push','--include-untracked','--message','preserved before verified release '+target[:12],'--',*info['reviewedPaths'])
            info['preservedStash']=git('rev-parse','refs/stash')
            write_json(backup/'release.json',info)
        run('git','merge','--ff-only',target)
        ensure(git('rev-parse','HEAD')==target,'Live checkout did not fast-forward')
        switch_build(release / '.next')
        run('pm2', 'restart', PM2, '--update-env', stdout=subprocess.DEVNULL)
        for attempt in range(25):
            try:
                if responding_version()==target and status_code('/th') == 200 and status_code('/api/admin/discord-studio/api/state') == 401:
                    break
            except (OSError, urllib.error.URLError):
                pass
            time.sleep(1)
        else:
            raise RuntimeError('Release health/access checks failed')
        processes=json.loads(subprocess.check_output(['pm2','jlist'],text=True))
        process=next(p for p in processes if p['name']==PM2)
        ensure(process['pm2_env']['status']=='online' and process['pid']>0,'Managed web process is not online')
        ensure(json.loads((ROOT / '.next/release-info.json').read_text())['commit'] == target,'Running build manifest mismatch')
    except BaseException:
        rollback(info,backup)
        raise
    write_json(ROOT / '.deploy/current.json', info)
    print(json.dumps(dict(deployedCommit=target, release=str(release), backup=str(backup), checkoutMatches=True, runningBuildMatches=True)))

def activate(release_path,preserve):
    import fcntl
    with (ROOT.parent/'.aclassstore-deploy.lock').open('a') as lock:
        os.chmod(lock.name,0o600)
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        activate_locked(release_path,preserve)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='action', required=True)
    build = commands.add_parser('prepare')
    build.add_argument('commit')
    build.add_argument('--font-cache')
    build.add_argument('--baseline',required=True)
    deploy = commands.add_parser('activate')
    deploy.add_argument('release')
    deploy.add_argument('--preserve-vps-edits', action='store_true')
    args = parser.parse_args()
    if args.action == 'prepare':
        prepare(args.commit, args.font_cache, args.baseline)
    else:
        activate(args.release, args.preserve_vps_edits)
