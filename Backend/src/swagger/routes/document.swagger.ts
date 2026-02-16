/**
 * @swagger
 * tags:
 *   name: Documents
 *   description: Document management (RC, Insurance, PUC, DL)
 */

/**
 * @swagger
 * /api/v1/documents:
 *   post:
 *     summary: Upload a new document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               type:
 *                 type: string
 *                 enum: [RC, INSURANCE, PUC, FASTAG, DL, OTHER]
 *               vehicleId:
 *                 type: string
 *               documentNumber:
 *                 type: string
 *               issueDate:
 *                 type: string
 *                 format: date-time
 *               expiryDate:
 *                 type: string
 *                 format: date-time
 *               issuerName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Document uploaded successfully
 *   get:
 *     summary: List all documents for the customer
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of documents
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   type:
 *                     type: string
 *                   fileUrl:
 *                     type: string
 *                   expiryDate:
 *                     type: string
 */

/**
 * @swagger
 * /api/v1/documents/{id}:
 *   get:
 *     summary: Get document details
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document details
 *   delete:
 *     summary: Delete a document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document deleted
 */

/**
 * @swagger
 * /api/v1/documents/digilocker/connect:
 *   get:
 *     summary: Initiate DigiLocker connection
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns DigiLocker auth URL
 *
 * /api/v1/documents/digilocker/callback:
 *   get:
 *     summary: DigiLocker OAuth callback
 *     tags: [Documents]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: DigiLocker connected
 *
 * /api/v1/documents/digilocker/sync:
 *   post:
 *     summary: Sync documents from DigiLocker
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync successful
 */

