This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Phone OTP Reporting

Reporting requires Firebase Phone Authentication and a server-only Supabase service-role key.

1. In Firebase Console, enable **Authentication → Phone** and add `localhost` under **Authentication → Settings → Authorized domains**. For a no-SMS demo, add the test number `+91 9898989898` with test code `123456` under **Phone numbers for testing**.
2. Copy `.env.example` to `.env.local` and fill in the Firebase Web app values, Firebase Admin service-account values, and Supabase service-role key. Keep `FIREBASE_PRIVATE_KEY` and `SUPABASE_SERVICE_ROLE_KEY` server-only; never prefix them with `NEXT_PUBLIC_` or commit them.
3. Run [supabase/require_verified_report_phone.sql](supabase/require_verified_report_phone.sql) in the Supabase SQL Editor. This removes the public insert policy so reports must go through the verified API route.
4. Restart the development server, then enter `9898989898` and `123456` to test a report.

Firebase verifies the OTP. The Next.js API route verifies the resulting ID token and writes the phone number from that verified token to Supabase.

## Official Report Management

Set a long random `ADMIN_KEY` in `.env.local` to enable the protected `/admin` page. The key is held in browser memory and sent to the server route in an `x-admin-key` header; report data is only returned after the server validates it. The admin API requires `SUPABASE_SERVICE_ROLE_KEY`, which stays server-side. Do not commit either secret. Restart the development server after setting `ADMIN_KEY`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
