/**
 * @swagger
 * tags:
 *   name: Sharing
 *   description: Vehicle access sharing management
 */

/**
 * @swagger
 * /api/v1/sharing/share:
 *   post:
 *     summary: Invite or share a vehicle with another customer
 *     tags: [Sharing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vehicleId
 *               - phoneNumber
 *               - role
 *             properties:
 *               vehicleId:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *                 example: "9876543210"
 *               role:
 *                 type: string
 *                 enum: [OWNER, EDITOR, VIEWER]
 *                 default: VIEWER
 *     responses:
 *       200:
 *         description: Vehicle shared successfully
 *       404:
 *         description: Vehicle or target user not found
 */

/**
 * @swagger
 * /api/v1/sharing/shared-with-me:
 *   get:
 *     summary: List vehicles shared WITH the current user
 *     tags: [Sharing]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of vehicles shared with me
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */

/**
 * @swagger
 * /api/v1/sharing/vehicle/{vehicleId}/access:
 *   get:
 *     summary: List people the current user has shared a specific vehicle WITH
 *     tags: [Sharing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of access records for this vehicle
 */

/**
 * @swagger
 * /api/v1/sharing/vehicle/{vehicleId}/access/{targetCustomerId}:
 *   delete:
 *     summary: Revoke access for a specific customer
 *     tags: [Sharing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: targetCustomerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Access revoked successfully
 */
