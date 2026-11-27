"""Rollback fault injection; no network, PM2, Git or live file mutations."""
import importlib.util
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('release',Path(__file__).with_name('deploy-verified-release.py'))
release=importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)

class RollbackChecks(unittest.TestCase):
    def exercise(self,fail_checkout=False):
        calls=[]
        refs={'HEAD':'new','refs/heads/main':'new'}
        info=dict(commit='new',previousHead='old',previousNext='/old/.next',previousVersion='old',preservedStash='stash',reviewedCheckout={'source':'hash'})
        def run(*args,**kwargs):
            calls.append(args)
            if args[:3]==('git','switch','--detach'):
                if fail_checkout:
                    raise RuntimeError('injected checkout failure')
                refs['HEAD']=args[3]
            if args[:2]==('git','update-ref'):
                self.assertEqual(refs[args[2]],args[4])
                refs[args[2]]=args[3]
        def git(*args,**kwargs):
            return refs[args[1]]
        with patch.multiple(release,run=run,git=git,switch_build=lambda path:calls.append(('pointer',path)),status_code=lambda path:200,responding_version=lambda:'old',checkout_fingerprint=lambda:{'source':'hash'},write_json=lambda *args:None):
            if fail_checkout:
                with self.assertRaisesRegex(RuntimeError,'Rollback needs attention'):
                    release.rollback(info,Path('/backup'))
            else:
                release.rollback(info,Path('/backup'))
        return calls,refs,info

    def test_complete_rollback_restores_main_and_staged_edits(self):
        calls,refs,info=self.exercise()
        self.assertEqual(refs['refs/heads/main'],'old')
        self.assertIn(('git','switch','main'),calls)
        self.assertIn(('git','stash','apply','--index','stash'),calls)
        self.assertTrue(info['rolledBackBuildAndSource'])

    def test_git_failure_still_restores_pointer_and_restarts(self):
        calls,_,info=self.exercise(fail_checkout=True)
        self.assertIn(('pointer',Path('/old/.next')),calls)
        self.assertIn(('pm2','restart',release.PM2,'--update-env'),calls)
        self.assertFalse(info['rolledBackBuildAndSource'])

if __name__=='__main__':
    unittest.main()
