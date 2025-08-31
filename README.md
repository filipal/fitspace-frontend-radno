# FitSpace Frontend

This repository contains the React + TypeScript source for the FitSpace demo application built with [Vite](https://vitejs.dev/). The app provides a simple login page that routes to an avatar management screen.

## Getting Started

### Install dependencies

## Expanding the ESLint configuration
```bash
npm install
```

### Run the development server
```bash
npm run dev
```
The dev server runs on Vite's default port, usually `http://localhost:5173/`.

### Build for production
```bash
npm run build
```

The compiled output is placed in the `dist` directory.

### Lint the project
```bash
npm run lint
```

Running this command checks the project with ESLint.

### Page dimensions

The CSS variables `--page-width` and `--page-height` in `src/index.css` define
the main page dimensions. They default to `430px` and `932px` which match the
iPhone&nbsp;15&nbsp;Pro&nbsp;Max viewport. Adjust these values if you want to target other
breakpoints.
