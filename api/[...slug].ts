import app from '../server';

export default function handler(req: any, res: any) {
  try {
    return app(req, res);
  } catch (err: any) {
    console.error('[Vercel Serverless Error]', err);
    if (!res.headersSent) {
      res.status(200).json({
        success: false,
        error: err?.message || 'Server error',
      });
    }
  }
}
