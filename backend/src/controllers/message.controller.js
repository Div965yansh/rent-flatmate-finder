import * as messageService from '../services/message.service.js';

/**
 * POST /api/messages
 * Send a message in an accepted conversation (TENANT or OWNER only)
 */
export async function sendMessage(req, res, next) {
  try {
    const message = await messageService.sendMessage(req.user.id, req.body);
    res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/messages/:interestId
 * Get chronological messages in an accepted conversation with pagination (TENANT or OWNER only)
 */
export async function getMessages(req, res, next) {
  try {
    const { interestId } = req.params;
    const result = await messageService.getMessagesForInterest(
      req.user.id,
      interestId,
      req.query
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
