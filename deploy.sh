git fetch origin
git reset --hard origin/main
npm install
npx prisma db push
npx prisma generate
npm run build && pm2 restart AClassStore && pm2 restart paypal-mail-worker
