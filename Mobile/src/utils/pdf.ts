import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { generatePDF as convertToPDF } from 'react-native-html-to-pdf';
import RNShareCustom from 'react-native-share';
import RNFS from 'react-native-fs';
import { Vehicle } from '../services/vehicleService';

/**
 * Highly Optimized PDF Generation & Sharing Service
 */
export const PDFService = {
  /**
   * Generates a Registration Certificate PDF from vehicle data.
   * Uses minimal CSS for faster conversion.
   */
  async generateRCPDF(vehicle: Vehicle) {
    try {
      const dateStr = new Date().toLocaleDateString('en-GB');
      const rto = { ...vehicle.rtoDetails, ...vehicle };
      const fileName = `RC_${vehicle?.registrationNumber}_${Date.now()}`;
      
      const html = `
        <html>
          <body style="font-family: sans-serif; padding: 20px; color: #000;">
            <div style="border: 2px solid #000; padding: 20px; border-radius: 8px;">
              <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
                <h1 style="margin: 0; font-size: 18px;">REGISTRATION CERTIFICATE</h1>
                <p style="margin: 5px 0; font-size: 11px;">Govt. of India | ${rto.rto || 'Transport Dept'}</p>
              </div>
              <div style="display: flex; flex-wrap: wrap; margin-bottom: 10px;">
                <div style="width: 50%; margin-bottom: 10px;">
                  <b style="font-size: 9px; color: #666;">REGISTRATION NO</b><br/>
                  <span style="font-size: 14px; font-weight: bold;">${vehicle?.registrationNumber}</span>
                </div>
                <div style="width: 50%; margin-bottom: 10px;">
                  <b style="font-size: 9px; color: #666;">CHASSIS NO</b><br/>
                  <span style="font-size: 12px; font-weight: bold;">${vehicle?.chassisNumber || rto.chassisNo || 'N/A'}</span>
                </div>
              </div>
              <div style="border-top: 1px solid #eee; padding-top: 10px;">
                <p><b>Owner:</b> ${rto.ownerName || 'N/A'}</p>
                <p><b>Make/Model:</b> ${vehicle.make || rto.make || 'N/A'} ${vehicle.model || rto.model || 'N/A'}</p>
                <p><b>Vehicle Class:</b> ${rto.vehicleClass || 'N/A'}</p>
                <p><b>Fuel:</b> ${vehicle.fuelType || rto.fuelNorms || 'N/A'}</p>
                <p><b>Reg Date:</b> ${vehicle?.registrationDate || rto.regDate || 'N/A'}</p>
              </div>
              <div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #000; text-align: right; font-size: 10px;">
                Generated on ${dateStr} | Verified by Gupio
              </div>
            </div>
          </body>
        </html>
      `;

      const options = {
        html,
        fileName,
        directory: Platform.OS === 'android' ? 'Download' : 'Documents',
      };

      const file = await convertToPDF(options);
      return file?.filePath;
    } catch (error) {
      console.error('RC PDF Gen Error:', error);
      return null;
    }
  },

  /**
   * Creates a PDF from an image document.
   * Optimized to use direct file paths instead of massive base64 strings.
   */
  async createPDFFromImage(doc: any, vehicle: Vehicle) {
    try {
      let imageSrc = doc.imageUri;
      
      // If it's a remote URL, we must download it locally first for fast PDF processing
      if (imageSrc.startsWith('http')) {
        const localPath = `${RNFS.CachesDirectoryPath}/temp_img_${Date.now()}.jpg`;
        await RNFS.downloadFile({ fromUrl: imageSrc, toFile: localPath }).promise;
        imageSrc = `file://${localPath}`;
      }

      const options = {
        html: `
          <html>
            <body style="margin:0;padding:20px;display:flex;flex-direction:column;align-items:center;background:white;">
              <h1 style="font-family:Arial;font-size:24px;margin-bottom:5px;">${doc.type.toUpperCase()}</h1>
              <p style="font-family:Arial;font-size:14px;color:#666;margin-bottom:20px;">Plate: ${vehicle?.registrationNumber}</p>
              <img src="${imageSrc}" style="width:100%;max-height:800px;object-fit:contain;border:1px solid #ddd;" />
            </body>
          </html>
        `,
        fileName: `${doc.type.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
        directory: 'Documents',
      };

      const file = await convertToPDF(options);
      
      // Cleanup temp image if we downloaded one
      if (imageSrc.includes(RNFS.CachesDirectoryPath)) {
        setTimeout(() => RNFS.unlink(imageSrc.replace('file://', '')).catch(() => {}), 2000);
      }

      return file.filePath;
    } catch (error) {
      console.error('PDF Gen Error:', error);
      throw error;
    }
  },

  /**
   * Generates a single PDF containing multiple documents (Glovebox export).
   */
  async generateGloveboxPDF(docs: any[], vehicle: Vehicle) {
    try {
      const processedDocs = await Promise.all(docs.map(async (doc) => {
        let uri = doc.imageUri;
        if (uri.startsWith('http')) {
          const localPath = `${RNFS.CachesDirectoryPath}/temp_multi_${Math.random().toString(36).substring(7)}.jpg`;
          await RNFS.downloadFile({ fromUrl: uri, toFile: localPath }).promise;
          uri = `file://${localPath}`;
        }
        return { ...doc, optimizedUri: uri };
      }));

      const pagesHtml = processedDocs.map(doc => `
        <div style="page-break-after:always; padding: 20px; text-align: center; background: white;">
          <h1 style="font-family: Arial; font-size: 22px;">${doc.type.toUpperCase()}</h1>
          <p style="font-family: Arial; color: #666; font-size: 12px;">Vehicle: ${vehicle?.registrationNumber}</p>
          <img src="${doc.optimizedUri}" style="width: 100%; max-height: 800px; object-fit: contain; border: 1px solid #eee;" />
        </div>
      `).join('');

      const options = {
        html: `<html><body style="margin:0;padding:0;">${pagesHtml}</body></html>`,
        fileName: `Glovebox_${vehicle?.registrationNumber}_${Date.now()}`,
        directory: 'Documents',
      };

      const file = await convertToPDF(options);

      // Cleanup temp images
      processedDocs.forEach(doc => {
        if (doc.optimizedUri.includes(RNFS.CachesDirectoryPath)) {
          RNFS.unlink(doc.optimizedUri.replace('file://', '')).catch(() => {});
        }
      });

      return file.filePath;
    } catch (error) {
      console.error('Glovebox PDF Error:', error);
      throw error;
    }
  },

  /**
   * Shares a document instantly.
   * Optimized flow: Direct file sharing on Android, Optimized base64 only if necessary on iOS.
   */
  async shareDocument(doc: any, vehicle: Vehicle) {
    try {
      const isRC = doc?.type?.toUpperCase() === 'RC' || doc?.type?.toLowerCase() === 'reg certificate';
      
      // 1. Generate PDF (or reuse if we implement caching later)
      const pdfPath = isRC ? await this.generateRCPDF(vehicle) : await this.createPDFFromImage(doc, vehicle);
      if (!pdfPath) throw new Error("Failed to generate PDF");

      const fileName = `${doc.type.replace(/\s+/g, '_')}.pdf`;

      // 2. Prepare share options (optimized for both platforms)
      const shareOptions = {
        title: `Share ${doc.type}`,
        message: `Document for ${vehicle.registrationNumber}`,
        url: Platform.OS === 'android' ? `file://${pdfPath}` : `data:application/pdf;base64,${await RNFS.readFile(pdfPath, 'base64')}`,
        type: 'application/pdf',
        filename: fileName,
        failOnCancel: false,
      };

      // 3. Open share sheet
      await RNShareCustom.open(shareOptions);

      // 4. Background cleanup (don't wait for it)
      setTimeout(() => RNFS.unlink(pdfPath).catch(() => {}), 10000);
      
    } catch (error: any) {
      if (error?.message?.includes('User did not share')) return;
      console.error('Share Error:', error);
      Alert.alert("Error", "Could not process document. Please try again.");
    }
  },

  async requestStoragePermission() {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'App needs access to download the PDF',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        return false;
      }
    }
    return true;
  }
};
