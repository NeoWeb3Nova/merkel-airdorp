# Product

## Register

product

## Users

Web3 developers, airdrop operators, and eligible airdrop participants who need to verify and claim ERC20 token allocations through a wallet-connected browser interface. Primary context: desktop/laptop browser with MetaMask or another EVM wallet. Secondary context: mobile browsers for verification-only reading and proof education.

## Product Purpose

A verified ERC20 airdrop claim portal for Merkel Airdrop. Users connect a wallet, confirm the target network, inspect eligibility through Merkle Proofs, and claim MRKL tokens on-chain. The product also serves as an educational and operator-facing reference for how Merkle-root based token distribution works.

## Current Product Scope

- ERC20 MRKL token distribution, not native ETH distribution.
- Default Sepolia deployment configuration with local Hardhat override support.
- Claim portal, wallet/network status, contract reserve display, proof preview, simulated verification, and bilingual developer guide.
- Local demo registration for UX testing only; it does not change the on-chain Merkle Root.

## Brand Personality

Precision, trust, cryptographic clarity. Three words: **auditable**, **minimal**, **confident**. The interface should feel like a restrained financial infrastructure product: light surfaces, indigo CTAs, thin editorial headings, precise tables, and clear chain-state feedback.

## Anti-references

- Dark neon Web3 dashboards with excessive glow
- Generic AI-demo gradient cards with 32px+ border-radius
- Warm beige SaaS pages that feel non-financial
- Decorative glassmorphism blur
- Gradient text as a primary brand device
- Dense wallet jargon without explanatory hierarchy
- Hidden network/contract state

## Design Principles

1. **Trust before action** — Users should see wallet, network, contract, reserve, eligibility, and replay state before submitting a transaction.
2. **Cryptographic minimalism** — Merkle Root and Proof data are first-class product objects, not hidden implementation details.
3. **Institutional light surface** — Use Stripe-like white/cool-gray surfaces, indigo action hierarchy, thin headings, and restrained borders.
4. **Data density with hierarchy** — Tables, proof nodes, balances, and contract addresses should be scannable without visual clutter.
5. **Simulation is clearly labeled** — Demo/local-only actions must never look equivalent to real on-chain eligibility.
6. **Motion as feedback** — Animations should communicate hover, loading, or status transitions only.

## Accessibility & Inclusion

WCAG 2.1 AA minimum. All interactive elements keyboard-navigable. Reduced motion respected. Body text contrast ≥4.5:1, large text ≥3:1. No color-only state indicators; contract readiness, claim status, and demo mode must also be represented textually.
