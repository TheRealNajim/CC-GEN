# CC-GEN | Developer Payment Sandbox & Test Card Generator

> **CC-GEN** is a modern developer platform and visual sandbox suite designed for software engineers, QA teams, fintech builders, and UI designers. It allows teams to safely generate mathematically valid dummy credit cards, simulate checkout flows, test payment gateways (Stripe, PayPal, Adyen), and preview photorealistic 3D credit cards with zero financial risk.

---

## 🌟 Executive Summary

In modern payment engineering and UI/UX design, testing payment workflows with real credit cards is risky, complex, and prone to accidental charges. **CC-GEN** solves this by providing:
1. **100% Luhn-Validated Dummy Cards**: Algorithmic MOD-10 compliant card numbers for all major issuing networks (Visa, Mastercard, American Express, Discover, JCB).
2. **Interactive 3D Card Studio**: Live flippable credit card visualizer with metallic EMV chips, magnetic strips, and custom theme gradients.
3. **Automated Test Fixture Exporter**: Client-side bulk generation of test cards downloadable in JSON, CSV, XML, and SQL seed scripts.
4. **Developer Knowledge Base & Sandbox Docs**: Reference tables for 3DS authentication triggers, decline scenarios, and tabbed code snippets (JavaScript / cURL).

---

## 📁 Web Pages & Sitemap

| Page | File | Description |
| :--- | :--- | :--- |
| **Home Page** | [`index.html`](index.html) | The central gateway featuring an instant on-page card simulator, live Luhn validator, metrics bar, documentation highlights portal, and mini FAQ accordion. |
| **Card Library** | [`cc-gen.html`](cc-gen.html) | Interactive 3D flippable credit card customizer, 6 gradient theme swatches, pre-built template gallery, and client-side bulk file exporter (10 to 500 cards). |
| **Developer Documentation** | [`Documentation.html`](Documentation.html) | Comprehensive technical guide featuring standard test card tables, 3DS challenge codes, Luhn algorithm explanations, and copy-pasteable JavaScript (`fetch`) & cURL snippets. |
| **Support & FAQ Center** | [`faq.html`](faq.html) | Searchable help desk with real-time keyword filtering, category filter pills, smooth animated accordions, and a 24/7 support contact banner. |
| **Sign In Portal** | [`sign in.html`](sign%20in.html) | Modern authentication interface with split-view security trust badges, show/hide password toggle, remember-me persistence, and Google/GitHub OAuth shortcuts. |
| **Register Account** | [`sign up.html`](sign%20up.html) | Free developer onboarding page featuring password match validation, terms consent, and instant account creation simulation. |
| **Auth Success Landing** | [`loginsuccessful.html`](loginsuccessful.html) | Session-aware landing page shown after a real Google/GitHub sign-in. Displays the signed-in profile (avatar, name, email, provider) and a working Sign Out action. |

---

## 🔐 OAuth Sign-In (Google & GitHub)

Social sign-in/sign-up runs through **Vercel serverless functions** in the [`api/`](api/) directory — no backend framework or database is required. The flow is a standard OAuth 2.0 authorization-code handshake with CSRF state validation and an HMAC-SHA256 signed, HttpOnly session cookie.

| Route | Purpose |
| :--- | :--- |
| `GET /api/auth/google` | Starts Google OAuth (redirects to Google consent screen) |
| `GET /api/auth/github` | Starts GitHub OAuth (redirects to GitHub authorize screen) |
| `GET /api/auth/callback/google` | Google callback: exchanges the code, creates the session cookie |
| `GET /api/auth/callback/github` | GitHub callback: exchanges the code, creates the session cookie |
| `GET /api/auth/session` | Returns `{ authenticated, user }` for the current session |
| `GET /api/auth/logout` | Clears the session cookie and returns to the sign-in page |

### 1. Create the OAuth credentials

**Google** — [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → *Create Credentials* → *OAuth client ID* → *Web application*:
- Authorized redirect URI: `https://cc-gen-seven.vercel.app/api/auth/callback/google`
- (For local testing also add: `http://localhost:3000/api/auth/callback/google`)

**GitHub** — [GitHub Developer Settings](https://github.com/settings/developers) → *OAuth Apps* → *New OAuth App*:
- Authorization callback URL: `https://cc-gen-seven.vercel.app/api/auth/callback/github`
- (For local testing also add: `http://localhost:3000/api/auth/callback/github`)

### 2. Set the environment variables in Vercel

Project → *Settings* → *Environment Variables*:

| Variable | Value |
| :--- | :--- |
| `GOOGLE_CLIENT_ID` | From the Google OAuth client |
| `GOOGLE_CLIENT_SECRET` | From the Google OAuth client |
| `GITHUB_CLIENT_ID` | From the GitHub OAuth App |
| `GITHUB_CLIENT_SECRET` | From the GitHub OAuth App |
| `AUTH_SECRET` | Any long random string used to sign session cookies |

Generate an `AUTH_SECRET` locally with:

```bash
# macOS / Linux
openssl rand -hex 32

# Windows (PowerShell)
-join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
```

Then **redeploy the project**. Until the variables are set, the social buttons will show a friendly setup page explaining exactly what is missing.

### 3. Run locally

```bash
npm i -g vercel
vercel          # link the project (pulls env vars)
vercel dev      # serve the site + /api functions at http://localhost:3000
```

---

## 🛠️ Technology Stack & Design System

- **Structure**: Semantic HTML5 with accessibility attributes (`aria-label`, `<main>`, `<header>`, `<footer>`, `<aside>`, `<nav>`).
- **Styling**: Vanilla CSS3 with CSS Custom Properties (Design Tokens), CSS Grid, Flexbox, and 3D Transforms (`perspective`, `rotateY`).
- **Typography**: Google Fonts — *Plus Jakarta Sans* (Primary UI), *Inter* (Body Text), *JetBrains Mono* (Card Numbers & Code Snippets), *Poppins*.
- **Interactivity**: Vanilla JavaScript (ES6+) with zero external runtime dependencies.
- **Responsiveness**: Fluid layout system supporting Desktop (1200px+), Tablet (768px–1024px), and Mobile (375px–480px).

---

## 🔒 Safety & Legal Disclaimer

All credit card numbers generated by **CC-GEN** are purely artificial placeholders generated strictly according to the mathematical Luhn algorithm (MOD 10). They carry zero balance, have no connection to real banking entities, and are intended strictly for educational, design prototyping, and software sandbox testing.
