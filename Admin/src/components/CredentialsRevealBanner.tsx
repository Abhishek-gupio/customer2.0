import { Card, CardContent } from './ui/Card';

/**
 * The "account created — here's the one-time password" banner, shown right
 * after a dealer creates a staff account or an admin creates a dealer
 * account. Same UX both places, only the noun changes.
 */
export function CredentialsRevealBanner({
  noun,
  phoneNumber,
  password,
}: {
  noun: string;
  phoneNumber: string;
  password: string;
}) {
  return (
    <Card className="border-emerald-500/30 bg-emerald-500/[0.04]">
      <CardContent className="py-4">
        <p className="text-sm text-emerald-300">
          {noun} created. Share these sign-in details with them directly — this password is not shown again:
        </p>
        <p className="mt-2 font-mono text-sm text-white">
          Phone: {phoneNumber} · Password: {password}
        </p>
      </CardContent>
    </Card>
  );
}
