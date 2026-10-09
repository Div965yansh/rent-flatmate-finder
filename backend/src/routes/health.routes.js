import { Router } from 'express';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'rent-flatmate-finder-backend',
  });
});

export default router;
