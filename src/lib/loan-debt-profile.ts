export type LoanForProfile = {
  id: string;
  label: string;
  lender: string | null;
  amount: number;
  status: "EN_COURS" | "TERMINE" | "REMBOURSE_ANTICIPE";
  loanType: "AMORTISSABLE" | "IN_FINE" | "BULLET" | "OBLIGATION" | "COMPTE_COURANT";
  startDate: Date;
  endDate: Date;
  durationMonths: number;
  amortizationLines: Array<{
    period: number;
    dueDate: Date;
    remainingBalance: number;
  }>;
};

export type LoanTimelineItem = {
  id: string;
  label: string;
  lender: string;
  startDate: Date;
  endDate: Date;
  amount: number;
  currentCrd: number;
  monthsRemaining: number;
  progressPct: number;
  urgency: "critical" | "soon" | "normal";
};

export type DebtMonthPoint = {
  month: string; // "YYYY-MM"
  totalCrd: number;
};

export type DebtProfile = {
  timeline: LoanTimelineItem[];
  extinctionCurve: DebtMonthPoint[];
};

function toMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function monthDiff(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

export function buildDebtProfile(loans: LoanForProfile[], today: Date = new Date()): DebtProfile {
  const todayMonthStart = startOfMonth(today);
  const nextMonthStart = addMonths(todayMonthStart, 1);

  const activeLoans = loans.filter(
    (l) => l.status === "EN_COURS" && l.loanType !== "COMPTE_COURANT"
  );

  if (activeLoans.length === 0) return { timeline: [], extinctionCurve: [] };

  // --- Timeline ---
  const timeline: LoanTimelineItem[] = activeLoans.map((loan) => {
    // Derniere ligne dont la dueDate est dans le mois courant ou avant
    const pastLines = loan.amortizationLines
      .filter((l) => new Date(l.dueDate) < nextMonthStart)
      .sort((a, b) => b.period - a.period);

    const currentCrd = pastLines.length > 0 ? pastLines[0].remainingBalance : loan.amount;

    const endDate = new Date(loan.endDate);
    const monthsRemaining = Math.max(0, monthDiff(todayMonthStart, startOfMonth(endDate)));

    const progressPct = Math.min(
      100,
      Math.max(0, loan.amount > 0 ? Math.round(((loan.amount - currentCrd) / loan.amount) * 100) : 0)
    );

    const urgency: "critical" | "soon" | "normal" =
      monthsRemaining < 12 ? "critical" : monthsRemaining <= 36 ? "soon" : "normal";

    return {
      id: loan.id,
      label: loan.label,
      lender: loan.lender ?? "",
      startDate: new Date(loan.startDate),
      endDate,
      amount: loan.amount,
      currentCrd,
      monthsRemaining,
      progressPct,
      urgency,
    };
  });

  // --- Extinction curve ---
  // Plage : mois courant → mois de fin du dernier emprunt
  const maxEndDate = activeLoans.reduce((max, l) => {
    const ed = startOfMonth(new Date(l.endDate));
    return ed > max ? ed : max;
  }, todayMonthStart);

  // Index des lignes par emprunt : Map<loanId, sorted lines>
  const linesIndex = new Map<string, typeof activeLoans[0]["amortizationLines"]>();
  for (const loan of activeLoans) {
    linesIndex.set(
      loan.id,
      [...loan.amortizationLines].sort((a, b) => a.period - b.period)
    );
  }

  const extinctionCurve: DebtMonthPoint[] = [];
  let cursor = todayMonthStart;

  while (cursor <= maxEndDate) {
    const cursorEnd = addMonths(cursor, 1); // premier jour du mois suivant
    let totalCrd = 0;

    for (const loan of activeLoans) {
      const lines = linesIndex.get(loan.id)!;
      // Derniere ligne avec dueDate strictement avant le debut du mois suivant
      let best: (typeof lines)[0] | undefined;
      for (const line of lines) {
        if (new Date(line.dueDate) < cursorEnd) {
          best = line;
        } else {
          break;
        }
      }
      totalCrd += best !== undefined ? best.remainingBalance : loan.amount;
    }

    extinctionCurve.push({ month: toMonthKey(cursor), totalCrd });
    cursor = addMonths(cursor, 1);
  }

  return { timeline, extinctionCurve };
}