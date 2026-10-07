/**
 * SHAIVIKA IT TECHNOLOGIES — COMMERCIAL PROPOSAL PDF GENERATOR
 *
 * Generates high-fidelity, print-ready B2B commercial quotation PDFs
 * using PDFKit.
 *
 * Requirements:
 * - Professional international layout & typography
 * - High-contrast branding with official tagline and website
 * - Structured client & project summary
 * - Scope of work, deliverables, and timeline
 * - Commercial pricing breakdown with international currency support
 * - Payment terms, validity date, and authorization signature boxes
 * - Returns a binary PDF Buffer
 */

const PDFDocument = require('pdfkit');

/**
 * Format currency with appropriate symbols
 */
function formatCurrency(amount, currency = 'INR') {
  const num = Number(amount) || 0;
  const curr = (currency || 'INR').toUpperCase();
  const symbols = {
    'INR': '₹ ',
    'USD': '$ ',
    'GBP': '£ ',
    'EUR': '€ ',
    'AED': 'AED ',
    'AUD': 'A$ '
  };
  const sym = symbols[curr] || `${curr} `;
  return `${sym}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Formats date into readable string (e.g., 07 Oct 2026)
 */
function formatDate(dateVal) {
  if (!dateVal) return 'Upon Discussion';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(dateVal);
  }
}

/**
 * Generates a commercial proposal PDF buffer
 * @param {object} proposal - Proposal record from Supabase
 * @param {object} [lead] - Linked lead record
 * @returns {Promise<Buffer>}
 */
function generateProposalPdfBuffer(proposal, lead = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 45, right: 45 },
        bufferPages: true,
        info: {
          Title: `Proposal ${proposal.proposal_number || 'SIT'} - ${proposal.title || 'Project'}`,
          Author: 'SHAIVIKA IT TECHNOLOGIES',
          Subject: 'Commercial Proposal & Quotation',
          Creator: 'SHAIVIKA IT TECHNOLOGIES CRM Engine'
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));

      const clientLead = proposal.lead || lead || {};
      const clientName = clientLead.name || 'Valued Client';
      const clientCompany = clientLead.company || 'Direct Client';
      const clientEmail = clientLead.email || '';
      const clientPhone = clientLead.phone || 'N/A';
      const clientCountry = clientLead.country || 'Global';

      // ==========================================
      // 1. BRAND HEADER
      // ==========================================
      const brandColor = '#0F172A';
      const accentBlue = '#2563EB';
      const textDark = '#1E293B';
      const textMuted = '#64748B';
      const lightBg = '#F8FAFC';
      const borderColor = '#E2E8F0';

      // Header top bar
      doc.rect(45, 40, 505, 4).fill(accentBlue);

      // Company Title
      doc.fontSize(18)
        .font('Helvetica-Bold')
        .fillColor(brandColor)
        .text('SHAIVIKA IT TECHNOLOGIES', 45, 54);

      // Company Tagline
      doc.fontSize(8.5)
        .font('Helvetica')
        .fillColor(textMuted)
        .text('AI  •  SaaS  •  Software Engineering  •  Digital Transformation', 45, 76)
        .text('Website: https://shaivikaittechnologies.in/  |  Email: shaivikagroups@gmail.com', 45, 88);

      // Document Badge on Right
      doc.roundedRect(380, 50, 170, 48, 6).fill(lightBg).stroke(borderColor);
      doc.fontSize(9.5)
        .font('Helvetica-Bold')
        .fillColor(accentBlue)
        .text('COMMERCIAL PROPOSAL', 390, 58, { align: 'center', width: 150 });
      doc.fontSize(8.5)
        .font('Helvetica')
        .fillColor(textDark)
        .text(`No: ${proposal.proposal_number || 'SIT-2026-DRAFT'}`, 390, 72, { align: 'center', width: 150 });
      doc.fontSize(7.5)
        .fillColor(textMuted)
        .text(`Date: ${formatDate(proposal.created_at || new Date())}`, 390, 84, { align: 'center', width: 150 });

      doc.moveTo(45, 110).lineTo(550, 110).strokeColor(borderColor).stroke();

      // ==========================================
      // 2. CLIENT & PROJECT METADATA CARD
      // ==========================================
      const cardY = 120;
      doc.roundedRect(45, cardY, 505, 85, 6).fill(lightBg).stroke(borderColor);

      // Left Column: Client Details
      doc.fontSize(8)
        .font('Helvetica-Bold')
        .fillColor(accentBlue)
        .text('PREPARED FOR:', 58, cardY + 10);

      doc.fontSize(10)
        .font('Helvetica-Bold')
        .fillColor(textDark)
        .text(clientName, 58, cardY + 24);

      doc.fontSize(8.5)
        .font('Helvetica')
        .fillColor(textMuted)
        .text(`Company: ${clientCompany}`, 58, cardY + 38)
        .text(`Email: ${clientEmail}`, 58, cardY + 50)
        .text(`Phone / Country: ${clientPhone} (${clientCountry})`, 58, cardY + 62);

      // Vertical separator
      doc.moveTo(290, cardY + 10).lineTo(290, cardY + 75).strokeColor(borderColor).stroke();

      // Right Column: Proposal Metadata
      doc.fontSize(8)
        .font('Helvetica-Bold')
        .fillColor(accentBlue)
        .text('PROJECT OVERVIEW:', 305, cardY + 10);

      doc.fontSize(10)
        .font('Helvetica-Bold')
        .fillColor(textDark)
        .text(proposal.title || 'Technical Solution Implementation', 305, cardY + 24, { width: 235 });

      doc.fontSize(8.5)
        .font('Helvetica')
        .fillColor(textMuted)
        .text(`Timeline: ${proposal.timeline || 'Flexible'}`, 305, cardY + 50)
        .text(`Valid Until: ${formatDate(proposal.valid_until)}`, 305, cardY + 62);

      let currentY = 220;

      // ==========================================
      // 3. PROJECT SCOPE & OBJECTIVES
      // ==========================================
      doc.fontSize(10.5)
        .font('Helvetica-Bold')
        .fillColor(brandColor)
        .text('1. Executive Scope of Work', 45, currentY);

      currentY += 16;

      const scopeText = proposal.scope || clientLead.description || 'Enterprise software engineering and development services tailored to client specifications.';
      doc.fontSize(9)
        .font('Helvetica')
        .fillColor(textDark)
        .text(scopeText, 45, currentY, { width: 505, lineGap: 3 });

      currentY = doc.y + 14;

      // ==========================================
      // 4. DELIVERABLES & PHASES
      // ==========================================
      if (currentY > 640) { doc.addPage(); currentY = 50; }

      doc.fontSize(10.5)
        .font('Helvetica-Bold')
        .fillColor(brandColor)
        .text('2. Key Deliverables & Technical Milestones', 45, currentY);

      currentY += 16;

      const rawDeliverables = proposal.deliverables || '1. Architecture & Design Specification\n2. Implementation & Core Feature Modules\n3. Quality Assurance & System Verification\n4. Cloud Deployment & Production Handover\n5. Hypercare Support Window';
      const deliverableLines = rawDeliverables.split(/\r?\n/).filter(line => line.trim().length > 0);

      deliverableLines.forEach((line) => {
        if (currentY > 740) { doc.addPage(); currentY = 50; }
        doc.fontSize(8.5)
          .font('Helvetica')
          .fillColor(textDark)
          .text(`•  ${line.replace(/^[•\-\*]\s*/, '')}`, 55, currentY, { width: 490, lineGap: 2 });
        currentY = doc.y + 4;
      });

      currentY += 10;

      // ==========================================
      // 5. COMMERCIAL INVESTMENT & PRICING
      // ==========================================
      if (currentY > 600) { doc.addPage(); currentY = 50; }

      doc.fontSize(10.5)
        .font('Helvetica-Bold')
        .fillColor(brandColor)
        .text('3. Commercial Pricing & Investment Summary', 45, currentY);

      currentY += 16;

      // Pricing Table Header
      const tableX = 45;
      const tableW = 505;
      doc.rect(tableX, currentY, tableW, 24).fill('#1E293B');

      doc.fontSize(8.5)
        .font('Helvetica-Bold')
        .fillColor('#FFFFFF')
        .text('SERVICE / DELIVERABLE ITEM', tableX + 12, currentY + 7)
        .text('CURRENCY', tableX + 340, currentY + 7)
        .text('TOTAL AMOUNT', tableX + 410, currentY + 7, { width: 85, align: 'right' });

      currentY += 24;

      // Pricing Table Row
      doc.rect(tableX, currentY, tableW, 30).fill(lightBg).stroke(borderColor);
      doc.fontSize(9)
        .font('Helvetica')
        .fillColor(textDark)
        .text(proposal.title || 'Full Development Lifecycle & Delivery', tableX + 12, currentY + 10)
        .text((proposal.currency || 'INR').toUpperCase(), tableX + 340, currentY + 10);

      const formattedTotal = formatCurrency(proposal.amount, proposal.currency);
      doc.font('Helvetica-Bold')
        .fillColor(accentBlue)
        .text(formattedTotal, tableX + 410, currentY + 10, { width: 85, align: 'right' });

      currentY += 30;

      // Pricing Table Total Row
      doc.rect(tableX, currentY, tableW, 26).fill('#F1F5F9').stroke(borderColor);
      doc.fontSize(9)
        .font('Helvetica-Bold')
        .fillColor(brandColor)
        .text('TOTAL FIXED PROJECT INVESTMENT', tableX + 12, currentY + 8)
        .text(formattedTotal, tableX + 350, currentY + 8, { width: 145, align: 'right' });

      currentY += 38;

      // ==========================================
      // 6. PAYMENT TERMS & TIMELINE
      // ==========================================
      if (currentY > 640) { doc.addPage(); currentY = 50; }

      doc.fontSize(10)
        .font('Helvetica-Bold')
        .fillColor(brandColor)
        .text('4. Payment Terms & Timeline', 45, currentY);

      currentY += 14;

      const paymentTerms = proposal.payment_terms || '50% Advance on project kickoff, 50% upon final acceptance & deployment.';
      doc.fontSize(8.5)
        .font('Helvetica')
        .fillColor(textDark)
        .text(`Payment Structure: ${paymentTerms}`, 45, currentY, { width: 505, lineGap: 2 });

      currentY = doc.y + 6;
      doc.text(`Estimated Timeline: ${proposal.timeline || 'Mutually scheduled upon agreement.'}`, 45, currentY);

      currentY = doc.y + 14;

      // ==========================================
      // 7. ADDITIONAL NOTES & TERMS
      // ==========================================
      if (proposal.additional_notes) {
        if (currentY > 640) { doc.addPage(); currentY = 50; }
        doc.fontSize(10)
          .font('Helvetica-Bold')
          .fillColor(brandColor)
          .text('5. Additional Commercial & Technical Notes', 45, currentY);
        currentY += 14;
        doc.fontSize(8.5)
          .font('Helvetica')
          .fillColor(textMuted)
          .text(proposal.additional_notes, 45, currentY, { width: 505, lineGap: 2 });
        currentY = doc.y + 14;
      }

      // ==========================================
      // 8. SIGNATURE / AUTHORIZATION BLOCK
      // ==========================================
      if (currentY > 650) { doc.addPage(); currentY = 50; }

      currentY = Math.max(currentY, 660);

      doc.roundedRect(45, currentY, 240, 75, 4).fill(lightBg).stroke(borderColor);
      doc.fontSize(8)
        .font('Helvetica-Bold')
        .fillColor(textDark)
        .text('AUTHORIZED BY (SHAIVIKA IT TECHNOLOGIES):', 55, currentY + 10);
      doc.fontSize(7.5)
        .font('Helvetica')
        .fillColor(textMuted)
        .text('Authorized Commercial Representative', 55, currentY + 45)
        .text('SHAIVIKA IT TECHNOLOGIES', 55, currentY + 57);

      doc.roundedRect(310, currentY, 240, 75, 4).fill(lightBg).stroke(borderColor);
      doc.fontSize(8)
        .font('Helvetica-Bold')
        .fillColor(textDark)
        .text('CLIENT ACCEPTANCE & SIGN-OFF:', 320, currentY + 10);
      doc.fontSize(7.5)
        .font('Helvetica')
        .fillColor(textMuted)
        .text(`Name: ${clientName}`, 320, currentY + 45)
        .text('Signature & Date: ____________________', 320, currentY + 57);

      // ==========================================
      // 9. MULTI-PAGE NUMBERING & FOOTER
      // ==========================================
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(7.5)
          .font('Helvetica')
          .fillColor(textMuted)
          .text(
            'SHAIVIKA IT TECHNOLOGIES  •  Confidential Commercial Quotation  •  https://shaivikaittechnologies.in/',
            45,
            795,
            { align: 'left', width: 400 }
          )
          .text(
            `Page ${i + 1} of ${range.count}`,
            445,
            795,
            { align: 'right', width: 105 }
          );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  formatCurrency,
  formatDate,
  generateProposalPdfBuffer
};
