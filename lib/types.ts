export type Member = {
  id: string;
  boardId: string;
  name: string;
  image: string | null;
  imageHappy: string | null;
  imageSad: string | null;
  // Whether this name has been claimed with a password yet — never the
  // hash itself, which stays server-side.
  hasPassword: boolean;
};

export type Category = {
  id: string;
  boardId: string;
  name: string;
  scoringRule: string;
};

export type Board = {
  id: string;
  name: string;
  slug: string;
  joinCode: string | null;
  // Only present in the create-board response, or right after regenerating
  // it from admin settings — never on a general board read.
  adminCode?: string;
  createdBy: string;
  // The member row standing in for whoever created the board — set at
  // creation so the admin is always a member too, not just a name in
  // `createdBy`. Null for boards created before this existed.
  creatorMemberId: string | null;
  votingDurationHours: number;
  dailyOdLimit: number;
  members: Member[];
  categories: Category[];
};

export type Vote = {
  id: string;
  odId: string;
  memberId: string;
  vote: "OD" | "SMALL_OD" | "REJECT";
};

export type Asset = {
  id: string;
  categoryId: string;
  file: string | null;
  dialogue: string | null;
  severity: "MILD" | "MEDIUM" | "SEVERE" | null;
};

export type OD = {
  id: string;
  boardId: string;
  raisedById: string;
  accusedId: string;
  categoryId: string;
  description: string;
  evidence: string | null;
  status: "PENDING" | "CLOSED";
  finalScore: number | null;
  createdAt: string;
  closesAt: string;
  raisedBy: Member;
  accused: Member;
  category: Category;
  votes: Vote[];
};

export type LeaderboardEntry = Member & { score: number };
