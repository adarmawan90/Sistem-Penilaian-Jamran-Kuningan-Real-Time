import app from '../server.js';

export default function handler(req: any, res: any) {
  try {
    if (req.url && !req.url.startsWith('/api')) {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
    return app(req, res);
  } catch (err: any) {
    console.error('[Vercel Serverless Handler Error]', err);
    if (!res.headersSent) {
      res.status(200).json({
        success: false,
        error: err?.message || 'Server error',
      });
    }
  }
}
