import './globals.css';

export const metadata = {
  title: 'Script and Sync',
  description: 'Compare audio recordings against your manuscript',
};

export default function RootLayout({ children }) {
  const baseThemeVars = {
    '--cream': '#F4F1EE',
    '--cream-dark': '#EAE4DF',
    '--border': '#DDD0C4',
    '--border-light': '#EAE0D6',
    '--text': '#4C4846',
    '--text-muted': '#6D6663',
    '--text-light': '#9B928E',
    '--accent': '#8C7C94',
    '--accent-light': '#ECE6EF',
    '--accent-soft': '#F4EFF5',
    '--accent-surface': '#FAF7FA',
    '--accent-dark': '#6D6663',
    '--accent-border': '#D8CFDC',
    '--accent-border-strong': '#BAAFBF',
    '--accent-shadow': 'rgba(76, 72, 70, 0.12)',
    '--accent-shadow-strong': 'rgba(76, 72, 70, 0.2)',
    '--ink-dark': '#4C4846',
    '--success': '#74897D',
    '--success-light': '#EEF2EF',
    '--danger': '#C4514A',
    '--danger-light': '#FAEDEC',
    '--warning': '#C47F2A',
    '--warning-light': '#FDF3E3',
    fontFamily: "Optima, 'Avenir Next', 'Helvetica Neue', 'Segoe UI', sans-serif",
    fontWeight: 400,
    letterSpacing: '0.01em',
    background: 'var(--cream)',
    color: 'var(--text)',
    margin: 0,
  };

  return (
    <html lang="en">
      <body style={baseThemeVars}>{children}</body>
    </html>
  );
}
