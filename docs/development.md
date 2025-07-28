# ��‍💻 Development

## 🚀 Deployment

The project uses **Cloudflare Pages** for hosting and **GitHub Actions** for CI/CD automation.

### Live Application

- **Production URL**: [https://cs2-memory-game.pages.dev/](https://cs2-memory-game.pages.dev/)
- **Deployment**: Automatic from `master` branch

### CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/master.yml`) includes:

1. **🔍 Code Quality Checks**

   - ESLint linting (`npm run lint:eslint`)
   - Prettier formatting check (`npm run lint:prettier`)

2. **🧪 Testing**

   - Unit tests with Vitest (`npm run test`)
   - Comprehensive test coverage

3. **📦 Build & Deploy**
   - Nuxt build with Cloudflare Pages preset
   - Automatic deployment to Cloudflare Pages

### Manual Deployment

To trigger a manual deployment:

```bash
# Manual workflow trigger (requires GitHub CLI)
gh workflow run master.yml
```

## 📜 Available Scripts

| Script                    | Description                          |
| ------------------------- | ------------------------------------ |
| `npm run dev`             | Start development server             |
| `npm run build`           | Build for production                 |
| `npm run generate`        | Generate static site                 |
| `npm run preview`         | Preview production build             |
| `npm run test`            | Run unit tests with Vitest           |
| `npm run test:ui`         | Run tests with UI interface          |
| `npm run test:run`        | Run tests once                       |
| `npm run test:coverage`   | Run tests with coverage report       |
| `npm run test:e2e`        | Run end-to-end tests with Playwright |
| `npm run test:e2e:ui`     | Run E2E tests with UI                |
| `npm run test:e2e:headed` | Run E2E tests in headed mode         |
| `npm run lint`            | Run TypeScript type checking         |
| `npm run lint:eslint`     | Run ESLint                           |
| `npm run lint:prettier`   | Check Prettier formatting            |
| `npm run lint:all`        | Run all linting checks               |
| `npm run lint:fix`        | Fix linting and formatting issues    |
