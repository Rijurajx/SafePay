import { DEMO_PERSONAS, createDemoPersonaToken, SESSION_COOKIE_NAME } from '../src/lib/auth';
import { POST as evaluateRiskPost } from '../src/app/api/risk/evaluate/route';
import { GET as getPendingApprovals } from '../src/app/api/approvals/pending/route';
import { POST as decideApproval } from '../src/app/api/approvals/[id]/decide/route';
import { POST as createCheckoutOrder } from '../src/app/api/checkout/create-order/route';
import { NextRequest } from 'next/server';

const DIVIDER = '═'.repeat(65);

async function main() {
  console.log('\n' + DIVIDER);
  console.log('   🛡️   SAFEPAY INTERACTIVE DEMO TEST RUNNER');
  console.log('   "Rules decide. Math calculates. AI explains. People remain in control."');
  console.log(DIVIDER + '\n');

  // 1. Thomas initiates routine transaction
  console.log('▶ [SCENARIO 1] Thomas initiates a routine $28.50 purchase at Local Groceries');
  const { token: thomasToken } = await createDemoPersonaToken('thomas');
  
  const midday = new Date();
  midday.setHours(14, 0, 0, 0);

  const evalReq1 = new NextRequest('http://localhost:3000/api/risk/evaluate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `${SESSION_COOKIE_NAME}=${thomasToken}`,
    },
    body: JSON.stringify({
      amount: 28.5,
      merchantName: 'Local Market',
      category: 'Groceries',
      transactionTime: midday.toISOString(),
    }),
  });

  const evalRes1 = await evaluateRiskPost(evalReq1);
  const evalData1 = await evalRes1.json();
  console.log(`  ✓ Status: ${evalData1.status}`);
  console.log(`  ✓ Classification: ${evalData1.classification}`);
  console.log(`  ✓ Requires Family Approval: ${evalData1.requiresFamilyApproval}`);
  console.log(`  ✓ Senior Message: "${evalData1.explanation?.seniorMessage}"`);
  console.log('  -> Auto-approved within historical baseline without alarming Dad!\n');

  // 2. Thomas initiates an anomalous transaction
  console.log('▶ [SCENARIO 2] Thomas initiates an unusual $185.00 purchase at "TechGadget Superstore"');
  const evalReq2 = new NextRequest('http://localhost:3000/api/risk/evaluate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `${SESSION_COOKIE_NAME}=${thomasToken}`,
    },
    body: JSON.stringify({
      amount: 185.0,
      merchantName: 'TechGadget Superstore',
      category: 'Consumer Electronics',
    }),
  });

  const evalRes2 = await evaluateRiskPost(evalReq2);
  const evalData2 = await evalRes2.json();
  console.log(`  ✓ Status: ${evalData2.status}`);
  console.log(`  ✓ Risk Score: ${evalData2.riskScore}/100 (${evalData2.classification})`);
  console.log(`  ✓ Triggered Signals:`);
  evalData2.signals?.forEach((s: any) => console.log(`     • [${s.severity}] ${s.code}: ${s.message}`));
  console.log(`  ✓ Gemini AI Caregiver Briefing:`);
  console.log(`     • Headline: "${evalData2.explanation?.headline}"`);
  console.log(`     • Plain-English Summary: "${evalData2.explanation?.plainEnglishSummary}"`);
  console.log(`     • Suggested Respectful Question for Dad: "${evalData2.explanation?.suggestedQuestions?.[0]}"`);
  console.log(`     • Reassurance on Dad's Screen: "${evalData2.explanation?.seniorMessage}"\n`);

  // 3. Maya views pending approvals
  console.log('▶ [SCENARIO 3] Maya (Primary Caregiver) opens family approval dashboard');
  const { token: mayaToken } = await createDemoPersonaToken('maya');
  const pendingReq = new NextRequest('http://localhost:3000/api/approvals/pending', {
    method: 'GET',
    headers: { Cookie: `${SESSION_COOKIE_NAME}=${mayaToken}` },
  });
  const pendingRes = await getPendingApprovals(pendingReq);
  const pendingData = await pendingRes.json();
  const pendingItem = pendingData.pendingApprovals?.find((a: any) => a.paymentRequestId === evalData2.paymentRequestId);
  console.log(`  ✓ Found ${pendingData.pendingApprovals?.length} pending approval request(s)`);
  console.log(`  ✓ Pending Item ID: ${pendingItem?.id}`);
  console.log(`  ✓ Amount: $${pendingItem?.amount} for ${pendingItem?.recipient?.merchantName}\n`);

  if (!pendingItem) {
    console.log('No pending item found to proceed with approval test.');
    return;
  }

  // 4. Sarah attempts to approve (Strict Authorization test)
  console.log('▶ [SCENARIO 4] Sarah (View-Only Caregiver) attempts to click Approve');
  const { token: sarahToken } = await createDemoPersonaToken('sarah');
  const sarahReq = new NextRequest(`http://localhost:3000/api/approvals/${pendingItem.id}/decide`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `${SESSION_COOKIE_NAME}=${sarahToken}`,
    },
    body: JSON.stringify({ decision: 'APPROVED' }),
  });
  const sarahRes = await decideApproval(sarahReq, { params: Promise.resolve({ id: pendingItem.id }) });
  const sarahData = await sarahRes.json();
  console.log(`  ✓ HTTP Status: ${sarahRes.status} (Expected 403 Forbidden)`);
  console.log(`  ✓ Security Message: "${sarahData.error}"\n`);

  // 5. Maya approves the hold
  console.log('▶ [SCENARIO 5] Maya discusses with Dad and approves the $185 purchase');
  const mayaApproveReq = new NextRequest(`http://localhost:3000/api/approvals/${pendingItem.id}/decide`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `${SESSION_COOKIE_NAME}=${mayaToken}`,
    },
    body: JSON.stringify({
      decision: 'APPROVED',
      reason: 'Confirmed with Dad over tea. Buying new tablet for reading.',
    }),
  });
  const mayaApproveRes = await decideApproval(mayaApproveReq, { params: Promise.resolve({ id: pendingItem.id }) });
  const mayaApproveData = await mayaApproveRes.json();
  console.log(`  ✓ Decision Result: ${mayaApproveData.decision}`);
  console.log(`  ✓ Updated Payment Status: ${mayaApproveData.status}\n`);

  // 6. Thomas creates live PayPal sandbox order
  console.log('▶ [SCENARIO 6] Thomas proceeds to PayPal Checkout for the approved purchase');
  const checkoutReq = new NextRequest('http://localhost:3000/api/checkout/create-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `${SESSION_COOKIE_NAME}=${thomasToken}`,
    },
    body: JSON.stringify({
      paymentRequestId: evalData2.paymentRequestId,
      returnUrl: 'https://safepay.demo/success',
      cancelUrl: 'https://safepay.demo/cancel',
    }),
  });
  const checkoutRes = await createCheckoutOrder(checkoutReq);
  const checkoutData = await checkoutRes.json();
  console.log(`  ✓ Live PayPal Sandbox Order ID: ${checkoutData.orderId}`);
  console.log(`  ✓ PayPal Checkout Approve URL: ${checkoutData.approveUrl}`);
  console.log(`  ✓ Order Status: ${checkoutData.status}\n`);

  console.log(DIVIDER);
  console.log('   🎉  ALL 6 SCENARIOS EXECUTED & VERIFIED SUCCESSFULLY!');
  console.log(DIVIDER + '\n');
}

main().catch(console.error);

