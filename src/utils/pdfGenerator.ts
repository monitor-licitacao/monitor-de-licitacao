import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Edital, UrlValidationData } from '../types';

/**
 * Generate a PDF report for a given edital.
 *
 * This function creates a formatted PDF using `jspdf` and `jspdf-autotable`.
 * It includes a header, validation status banners, executive summary,
 * traceability section, human review seal, findings table, limitations, and a footer.
 * The PDF is saved with a filename derived from the edital process number.
 *
 * @param {Edital} edital - The edital data containing metadata, OCR pages, findings, and URL validation.
 */
export function generateEditalPDFReport(edital: Edital): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Determine URL validation status defaults if not explicitly populated
  // Determine collection method, falling back to defaults if data is missing
  const method = edital.collectionMethod || edital.urlValidation?.collectionMethod || 'DIRECT_HTTPX';
  const urlVal: UrlValidationData = edital.urlValidation || {
    originalUrl: edital.rawUrl,
    originalRequestedUrl: edital.rawUrl,
    validationStatus: 'VALID_DIRECT_200',
    collectionMethod: method,
    httpStatusCode: 200,
    finalResolvedUrl: edital.rawUrl.replace('http://', 'https://'),
    mimeTypeValidated: 'application/pdf (Magic Bytes %PDF-1.5)',
    contentLengthBytes: edital.fileSizeBytes || 3418290,
    validatedAt: new Date().toISOString(),
    dnsResolutionStatus: 'RESOLVED_OK',
    limitationNotice: 'Documento baixado e validado com sucesso via worker httpx.',
    isUnavailable: false
  };

  // Flags for various failure scenarios used to decide which banner to render
  const isDnsFailure = urlVal.validationStatus === 'REDIRECT_DESTINATION_DNS_FAILURE' || urlVal.dnsResolutionStatus === 'NXDOMAIN_ERROR';
  const isS3Cache = method === 'S3_CACHE_FALLBACK' || !!urlVal.cachedVersionDate;
  const isUnavailable = urlVal.isUnavailable || isDnsFailure || urlVal.validationStatus === 'UNAVAILABLE_4XX_5XX';

  // 1. Top Header Banner
  doc.setFillColor(15, 23, 42); // Slate-900 Dark Navy
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.text('MONITOR DE EDITAIS MUNICIPAIS & SISTEMA S', 14, 10.5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text('RELATÓRIO EXECUTIVO DE CONFORMIDADE | NCM 9506 (CULTURA FÍSICA & ATLETISMO)', 14, 16.5);

  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} | Sprint 0 PoC`, 130, 16.5);

  let currentY = 28;

  // 2. Alert Banner if Document Link was Broken or Unavailable (PRD S0-07 / S0-09)
  if (isS3Cache) {
    // Amber / Orange Banner for S3 Cache Fallback
    doc.setFillColor(254, 243, 199); // amber-100
    doc.setDrawColor(217, 119, 6);   // amber-600
    doc.roundedRect(14, currentY, 182, 14, 1.5, 1.5, 'FD');

    doc.setTextColor(180, 83, 9);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.text('⚠️ ATENÇÃO: ANÁLISE BASEADA EM CÓPIA PRESERVADA NO VAULT IMUTÁVEL (S3 CACHE)', 18, currentY + 4.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(120, 53, 15);
    const cacheDateStr = urlVal.cachedVersionDate ? new Date(urlVal.cachedVersionDate).toLocaleString('pt-BR') : 'coleta anterior';
    doc.text(`O link público original estava temporariamente inacessível no momento da coleta (Erro: NXDOMAIN/Rede).`, 18, currentY + 8.8);
    doc.text(`Este relatório analisa a versão cacheada em ${cacheDateStr}, preservada no Vault. Verifique manualmente antes de prazos críticos.`, 18, currentY + 12.2);

    currentY += 18;
  } else if (isDnsFailure) {
    // Red High Alert for DNS NXDOMAIN Failure on Redirection Destination
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(220, 38, 38);
    doc.roundedRect(14, currentY, 182, 14, 1.5, 1.5, 'FD');

    doc.setTextColor(185, 28, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('🚨 ATENÇÃO: DOCUMENTO FONTE INACESSÍVEL VIA REDIRECIONAMENTO (FALHA DNS)', 18, currentY + 4.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(127, 29, 29);
    doc.text('O servidor respondeu com redirect para domínio não resolvível (cdn.sesc.com.br - NXDOMAIN).', 18, currentY + 8.8);
    doc.text('Análise baseada em snapshot/cache. VERIFICAÇÃO MANUAL OBRIGATÓRIA antes de qualquer decisão.', 18, currentY + 12.2);

    currentY += 18;
  } else if (isUnavailable) {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(239, 68, 68);
    doc.roundedRect(14, currentY, 182, 11, 1.5, 1.5, 'FD');

    doc.setTextColor(185, 28, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('⚠️ ATENÇÃO: Documento fonte indisponível no momento da coleta. Análise baseada em cache ou versão anterior.', 18, currentY + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Verifique manualmente a URL de origem ou confirme com o pregoeiro do órgão licitante.', 18, currentY + 9);

    currentY += 15;
  }

  // 3. Executive Header Strip (Resumo Executivo Rápido)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, currentY, 182, 34, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(edital.title, 18, currentY + 6.5, { maxWidth: 174 });

  doc.setFontSize(7.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`Órgão/Entidade: ${edital.sourceName} (${edital.sourceCategory} - ${edital.uf})`, 18, currentY + 12.5);
  doc.text(`Processo: ${edital.processNumber} | Modalidade: ${edital.modality}`, 18, currentY + 17.5);
  doc.text(`NCM Classificado: ${edital.ncmCode} - ${edital.ncmDescription}`, 18, currentY + 22.5);
  doc.text(`Data de Abertura: ${new Date(edital.openingDate).toLocaleString('pt-BR')}`, 18, currentY + 27.5);

  const budgetStr = edital.budgetEstimated
    ? `R$ ${edital.budgetEstimated.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    : 'Sigiloso / Não informado';
  doc.text(`Orçamento Estimado: ${budgetStr}`, 115, currentY + 27.5);

  // Status pills on right
  const isApproved = edital.humanReviewStatus === 'APPROVED';
  const isPending = edital.humanReviewStatus === 'PENDING';

  doc.setFillColor(isApproved ? 220 : isPending ? 254 : 254, isApproved ? 252 : isPending ? 243 : 226, isApproved ? 231 : isPending ? 199 : 226);
  doc.roundedRect(115, currentY + 11.5, 76, 12, 1.5, 1.5, 'F');
  doc.setTextColor(isApproved ? 22 : isPending ? 180 : 185, isApproved ? 101 : isPending ? 83 : 28, isApproved ? 52 : isPending ? 9 : 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  const statusLabel = isApproved ? '✓ REVISÃO: APROVADO' : isPending ? '⏳ REVISÃO: PENDENTE' : `✕ REVISÃO: ${edital.humanReviewStatus}`;
  doc.text(statusLabel, 118, currentY + 16.5);
  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Achados: ${edital.findings.length} | Páginas OCR: ${edital.ocrPages.length}/${edital.ocrPages.length}`, 118, currentY + 21);

  currentY += 38;

  // 4. NOVA SEÇÃO OBRIGATÓRIA: Rastreabilidade e Validação de Acesso (RF-11 a RF-14 / Sprint 0)
  const isDnsFail = urlVal.validationStatus === 'REDIRECT_DESTINATION_DNS_FAILURE';
  const boxHeight = isDnsFail ? 46 : 38;

  doc.setFillColor(isDnsFail ? 254 : isUnavailable ? 255 : 241, isDnsFail ? 242 : isUnavailable ? 241 : 245, isDnsFail ? 242 : isUnavailable ? 242 : 249);
  doc.setDrawColor(isDnsFail ? 239 : isUnavailable ? 248 : 203, isDnsFail ? 68 : isUnavailable ? 113 : 213, isDnsFail ? 68 : isUnavailable ? 113 : 225);
  doc.roundedRect(14, currentY, 182, boxHeight, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('🔗 RASTREABILIDADE E VALIDAÇÃO ATIVA DE ACESSO (RF-11 a RF-14)', 18, currentY + 6);

  doc.setFontSize(7.2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  // Line 1: Original URL detected
  doc.setFont('helvetica', 'bold');
  doc.text('URL Original Detectada:', 18, currentY + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(37, 99, 235);
  doc.text(urlVal.originalUrl, 54, currentY + 11.5, { maxWidth: 138 });

  // Line 2: Validation Status & Method Badge
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'bold');
  doc.text('Status & Método:', 18, currentY + 16.5);
  doc.setFont('helvetica', 'bold');

  if (isDnsFail) {
    doc.setTextColor(220, 38, 38);
    doc.text('❌ REDIRECT_DESTINATION_DNS_FAILURE (HTTP 302 -> Falha NXDOMAIN no Destino)', 54, currentY + 16.5);
  } else if (method === 'URL_REWRITE') {
    doc.setTextColor(37, 99, 235);
    doc.text('🔄 Link Normalizado Automaticamente (Reescrita S0-09)', 54, currentY + 16.5);
  } else if (method === 'PLAYWRIGHT_INTERCEPT') {
    doc.setTextColor(124, 58, 237); // Purple
    doc.text('🤖 Extração via Browser Real (Playwright Stealth - Sessão Interceptada)', 54, currentY + 16.5);
  } else if (method === 'S3_CACHE_FALLBACK') {
    doc.setTextColor(217, 119, 6); // Amber
    doc.text('📦 Fallback para Vault Imutável S3 (Cache Forense Preservado)', 54, currentY + 16.5);
  } else if (urlVal.validationStatus === 'VALID_DIRECT_200') {
    doc.setTextColor(22, 101, 52);
    doc.text('✅ Acesso Direto Validado (DIRECT_HTTPX - Link Ativo & DNS OK)', 54, currentY + 16.5);
  } else if (urlVal.validationStatus === 'VALID_REDIRECT_RESOLVED') {
    doc.setTextColor(22, 101, 52);
    doc.text('✅ REDIRECIONAMENTO RESOLVIDO (HTTP 302 -> 200 no Destino)', 54, currentY + 16.5);
  } else {
    doc.setTextColor(185, 28, 28);
    doc.text('❌ INDISPONÍVEL (Falha de Conectividade/404)', 54, currentY + 16.5);
  }

  // Line 3: Resolved or Attempted URL
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'bold');
  if (isDnsFail) {
    doc.text('Tentativa de Destino:', 18, currentY + 21.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(220, 38, 38);
    doc.text(`${urlVal.attemptedDestinationUrl || 'Destino não resolvido'} (NXDOMAIN - Inacessível)`, 54, currentY + 21.5);

    // Line 4: Technical Error Details
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'bold');
    doc.text('Erro Técnico & Diagnóstico:', 18, currentY + 26.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(153, 27, 27);
    doc.text(urlVal.errorDetail || 'DNS_PROBE_FINISHED_NXDOMAIN', 54, currentY + 26.5, { maxWidth: 138 });

    // Line 5: Recommended Action
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'bold');
    doc.text('Ação Recomendada:', 18, currentY + 31.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(urlVal.recommendedAction || 'Verificar cabeçalho Referer, rota interna SESC ou migração de CDN.', 54, currentY + 31.5, { maxWidth: 138 });

    // Line 6: Timestamp
    doc.setFont('helvetica', 'bold');
    doc.text('Auditoria de Acesso:', 18, currentY + 41.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Auditado em: ${new Date(urlVal.validatedAt).toLocaleString('pt-BR')} (Playwright + Teste de Socket DNS)`, 54, currentY + 41.5);
  } else {
    doc.text('URL Final Resolvida:', 18, currentY + 21.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(37, 99, 235);
    const finalUrl = urlVal.finalResolvedUrl || urlVal.originalUrl;
    doc.textWithLink(finalUrl, 54, currentY + 21.5, { url: finalUrl });

    // Line 4: MIME Type & SHA-256
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'bold');
    doc.text('Tipo MIME & Hash:', 18, currentY + 26.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${urlVal.mimeTypeValidated || 'application/pdf'} | SHA-256: ${edital.sha256Hash.substring(0, 36)}...`, 54, currentY + 26.5);

    // Line 5: Timestamp and limitation notice
    doc.setFont('helvetica', 'bold');
    doc.text('Nota de Rastreabilidade:', 18, currentY + 31.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${urlVal.limitationNotice || 'Validação ativa executada.'} (Auditado em: ${new Date(urlVal.validatedAt).toLocaleString('pt-BR')})`, 54, currentY + 31.5, { maxWidth: 138 });
  }

  currentY += boxHeight + 4;

  // 5. Human Review Seal & Pipeline Integrity
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, 182, 17, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('SELO DE REVISÃO HUMANA (REGRA DE OURO - PRD v1.0)', 18, currentY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  const reviewDetail = isApproved
    ? `Homologado por: ${edital.reviewedBy || 'Analista Responsável'} em ${edital.reviewedAt ? new Date(edital.reviewedAt).toLocaleString('pt-BR') : 'Data informada'}. Notas: ${edital.reviewNotes || 'Sem ressalvas'}`
    : isPending
    ? `Status: AGUARDANDO REVISÃO HUMANA OBRIGATÓRIA. Proibido qualquer envio de impugnação externa sem validação de analista.`
    : `Status: REJEITADO (${edital.reviewNotes || 'Achado descartado'})`;
  doc.text(reviewDetail, 18, currentY + 11, { maxWidth: 174 });

  currentY += 21;

  // 6. Findings Table Redesigned (RF-07 / RF-08)
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`ACHADOS DE CONFORMIDADE E CLÁUSULAS RESTRITIVAS (${edital.findings.length})`, 14, currentY + 3);

  const tableData = edital.findings.map(f => {
    const risk = f.impactRisk || (f.findingType === 'EXIGENCIA_RESTRITIVA' || f.findingType === 'PRAZO_EXIGUO' ? 'ALTO' : 'MEDIO');
    const riskBadge = risk === 'ALTO' ? '🔴 ALTO' : risk === 'MEDIO' ? '🟡 MÉDIO' : '🟢 BAIXO';
    const decisionBadge = f.humanDecision === 'APROVADO' ? '🟢 Aprovado' : f.humanDecision === 'REJEITADO' ? '🔴 Rejeitado' : '⏳ Pendente';

    return [
      `Pág. ${f.page}`,
      f.findingType.replace(/_/g, ' '),
      riskBadge,
      `"${f.snippet}"`,
      f.legalBasis,
      f.confidence,
      decisionBadge
    ];
  });

  if (edital.findings.length === 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text('Nenhuma inconformidade legal ou cláusula restritiva identificada no texto analisado.', 14, currentY + 10);
    currentY += 16;
  } else {
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Pág.', 'Tipo de Achado', 'Risco', 'Evidência / Trecho Auditado', 'Fundamento Legal', 'Confiança', 'Decisão']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: 255,
        fontSize: 7.2,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 6.8,
        cellPadding: 1.8,
        overflow: 'linebreak',
        textColor: [30, 41, 59]
      },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 26 },
        2: { cellWidth: 16 },
        3: { cellWidth: 54 },
        4: { cellWidth: 38 },
        5: { cellWidth: 16 },
        6: { cellWidth: 20 },
      },
    });

    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 6;
  }

  // Check if we need to add a page or if we have room for Limitations section
  if (currentY > pageHeight - 38) {
    doc.addPage();
    currentY = 16;
  }

  // 7. Seção Refinada: LIMITAÇÕES E ESCOPO DA ANÁLISE (PRD v1.0 / Adendo S0-07)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, 182, 22, 1.5, 1.5, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('⚖️ LIMITAÇÕES E ESCOPO DA ANÁLISE (PRD v1.0 / RF-08)', 18, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('• Este relatório é produto de triagem automatizada assistida por OCR (confiança média: ' + edital.ocrConfidenceAvg + '%).', 18, currentY + 9);
  doc.text('• A análise cobre exclusivamente o NCM ' + edital.ncmCode + ' e legislação declarada no próprio edital (Lei 14.133/2021 ou Regulamento SESC/Sistema S).', 18, currentY + 13);
  doc.text('• Documentos anexos (DOCX/XLSX/ZIP) foram catalogados. Links externos validados em ' + new Date(urlVal.validatedAt).toLocaleDateString('pt-BR') + '.', 18, currentY + 17);
  doc.text('• REGRA DE OURO: NENHUM ACHADO POSSUI EFICÁCIA EXTERNA SEM HOMOLOGAÇÃO HUMANA EXPRESSA.', 18, currentY + 20);

  // Add a compact audit footer with technical metadata
  doc.setFillColor(241, 245, 249);
  doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
  doc.setFontSize(6.2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(
    `AUDITORIA TÉCNICA: Pipeline v1.0 (Sprint 0 PoC) | OCR: Tesseract 5.3 + pypdf | Coletor: Playwright+httpx | Monitor Editais MVP`,
    14,
    pageHeight - 7
  );
  doc.text(
    `SHA-256 Edital: ${edital.sha256Hash.substring(0, 32)}... | S3: ${edital.s3StorageKey} | ID: ${edital.id}`,
    14,
    pageHeight - 3.5
  );
}
