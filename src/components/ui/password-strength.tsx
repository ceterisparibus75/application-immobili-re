"use client";

interface PasswordStrengthProps {
  password: string;
}

function getStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

const LABELS = ["", "Tres faible", "Faible", "Moyen", "Fort", "Tres fort"];
const COLORS = [
  "",
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-blue-500",
  "bg-green-500",
];

export function PasswordStrength({ password }: PasswordStrengthProps) {
  if (!password) return null;
  const strength = getStrength(password);

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= strength ? COLORS[strength] : "bg-muted"
            }`}
          />
        ))}
      </div>
      <p
        className={`text-xs ${
          strength < 3
            ? "text-destructive"
            : strength < 5
              ? "text-muted-foreground"
              : "text-green-600"
        }`}
      >
        {LABELS[strength]}
      </p>
    </div>
  );
}
