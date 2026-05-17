export type Medium = 'book' | 'movie' | 'tv';

export type Work = {
  slug: string;
  medium: Medium;
  title: string;
  creator: string;
  year: number | null;
};

export type Candidate = Work;

export type Rating =
  | {
      slug: string;
      known: true;
      score: number;       // 1-10
      verdict: string;
      synopsis: string;
      details: string;
      tags: string[];
      model: string;
      rated_at: string;
      view_count: number;
    }
  | {
      slug: string;
      known: false;
      model: string;
      rated_at: string;
      view_count: number;
    };

export type DisambiguateResponse = { candidates: Candidate[] };

export type RateRequest = { slug: string };
