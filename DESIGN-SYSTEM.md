# Protected Money Companion — Design System & Engineering Rules
> Encoded from the 9 core design skills (`recent.design/skills`)

---

## 1. The Design Philosophy

**"Rules decide. AI explains. People remain in control."**
Our interface mirrors this governance model: calm, unambiguous, tactile, and protective. We explicitly reject generic "AI-slop" (purple gradients, floaty glow borders, card clutter). Every visual choice serves dignity for Mr. Thomas and clarity for his family.

---

## 2. The 9 Master Skills & Their Application

| # | Skill | Purpose in Protected Money Companion | Primary Surface |
|---|-------|--------------------------------------|-----------------|
| 1 | **`anthropics/frontend-design`** | Base visual identity: editorial clarity, non-templated typography, opinionated palette (slate, navy, warm sand). | Universal |
| 2 | **`emilkowalski/apple-design`** | Fluid WWDC-grade spring physics, momentum, interruptible sheets, translucent materials. | Caregiver & Merchant |
| 3 | **`emilkowalski/emil-design-eng`** | Tactile micro-interactions (`active:scale-[0.98]`), button states, zero layout shifts. | All Interactions |
| 4 | **`mattpocock/grill-me`** | Stress-testing design decisions and edge cases before coding milestones. | Planning & Architecture |
| 5 | **`pbakaus/distill`** | Stripping UI to its essence: 1 primary action per screen, no visual noise. | **Mr. Thomas (Elder)** |
| 6 | **`pbakaus/quieter`** | Calming high-anxiety states: no flashing alarms, quiet neutral tones, soothing copy. | **Mr. Thomas (Elder)** |
| 7 | **`pbakaus/critique`** | Multi-perspective UX review with scored actionable feedback. | Milestone Audits |
| 8 | **`vercel-labs/web-design-guidelines`** | WCAG AAA accessibility, $\ge 44\times44$px touch targets, visible focus, contrast. | Universal (Elder Focus) |
| 9 | **`pbakaus/polish`** | Final pre-submission inspection: token alignment, optical centering, craft details. | Release Pass |

---

## 3. Surface Specifications

### A. Mr. Thomas (Protected User / Elder View)
- **Governed by:** `distill`, `quieter`, `web-design-guidelines`
- **Typography:** Minimum 18px base text, high legibility, generous line height (`leading-relaxed`).
- **Touch Targets:** Minimum 48px $\times$ 48px on all interactable elements.
- **Visual Restraint:** Flatter cards, soft borders (`border-slate-200`), no jarring saturated colors.
- **Language:** Plain English without technical jargon (e.g., "Family checking this purchase" instead of "ApprovalRequest PENDING_EVALUATION").
- **Cognitive Load:** One decision at a time. No nested menus or multi-column distractions.

### B. Caregiver Portal (Maya, David, Sarah)
- **Governed by:** `frontend-design`, `apple-design`, `emil-design-eng`
- **Density:** High-density, professional financial workbench with AG Grid and Recharts.
- **Motion:** Physical spring curves for modal sheets and approval drawers (`type: 'spring', damping: 25, stiffness: 200`).
- **Tactile Feedback:** Instant pressed states on buttons, clear optimistic UI with rollback resilience.
- **Clarity:** Distinct visual states for auto-approved, family-approved, flagged, and blocked purchases.

---

## 4. Verification Workflow for Future Milestones
Before any milestone UI is finalized:
1. **Grill:** Stress-test edge cases (`grill-me`).
2. **Distill & Quiet:** Strip unnecessary clutter (`distill`, `quieter`).
3. **Audit:** Verify accessibility and interaction targets (`web-design-guidelines`).
4. **Critique & Polish:** Score the UX and perform pixel-level craft pass (`critique`, `polish`).

