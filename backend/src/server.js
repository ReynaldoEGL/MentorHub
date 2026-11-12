import express from 'express';
const app = express();
app.use(express.json());
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'MentorHub API', version: '1.0.0' }));
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`MentorHub API listening on ${port}`));
