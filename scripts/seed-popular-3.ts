// scripts/seed-popular-3.ts
//
// Third seed batch (2026-08-02): 300 titles, broad mix per the seed-batch-3
// spec — ~120 general bestsellers/book-club/classics/thrillers (mostly "not
// smut" answers, which real searches want too), ~80 YA (the parent-checking
// use case), ~60 romance long-tail, ~40 movies/TV. Avoids everything in
// seed-popular.ts and seed-popular-2.ts. Runs each query through the real
// disambiguate + rate flow. Idempotent — cache hits skip Claude.
//
// Four 2026 releases are deliberate future-proofing: they will come back
// known:false (noindex) until the rating model's knowledge catches up, then
// cleanup-rerate.ts can recover them.
//
// Usage on this Windows box (TLS interception — pnpm dlx is blocked, use npm's npx):
//   NODE_TLS_REJECT_UNAUTHORIZED=0 npm_config_strict_ssl=false npx --yes \
//     tsx@latest --env-file=.env.local scripts/seed-popular-3.ts
//
// Required env (.env.local must hold PROD creds): NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, RATE_LIMIT_SALT.

import { runDisambiguate } from '../src/lib/disambiguate';
import { runRate } from '../src/lib/rate';
import type { Medium } from '../src/lib/types';

type SeedItem = { query: string; expect: Medium };

const SEED: SeedItem[] = [
  // ============================================================
  // General bestsellers, book club, classics, thrillers (~120)
  // ============================================================
  { query: 'Where the Crawdads Sing by Delia Owens', expect: 'book' },
  { query: 'Gone Girl by Gillian Flynn', expect: 'book' },
  { query: 'The Girl on the Train by Paula Hawkins', expect: 'book' },
  { query: 'Big Little Lies by Liane Moriarty', expect: 'book' },
  { query: 'Nine Perfect Strangers by Liane Moriarty', expect: 'book' },
  { query: 'The Husband\'s Secret by Liane Moriarty', expect: 'book' },
  { query: 'The Silent Patient by Alex Michaelides', expect: 'book' },
  { query: 'The Thursday Murder Club by Richard Osman', expect: 'book' },
  { query: 'All the Light We Cannot See by Anthony Doerr', expect: 'book' },
  { query: 'The Nightingale by Kristin Hannah', expect: 'book' },
  { query: 'The Great Alone by Kristin Hannah', expect: 'book' },
  { query: 'Firefly Lane by Kristin Hannah', expect: 'book' },
  { query: 'Educated by Tara Westover', expect: 'book' },
  { query: 'The Glass Castle by Jeannette Walls', expect: 'book' },
  { query: 'Untamed by Glennon Doyle', expect: 'book' },
  { query: 'Project Hail Mary by Andy Weir', expect: 'book' },
  { query: 'The Martian by Andy Weir', expect: 'book' },
  { query: 'Ready Player One by Ernest Cline', expect: 'book' },
  { query: 'Dune by Frank Herbert', expect: 'book' },
  { query: 'The Handmaid\'s Tale by Margaret Atwood', expect: 'book' },
  { query: 'Circe by Madeline Miller', expect: 'book' },
  { query: 'The House in the Cerulean Sea by TJ Klune', expect: 'book' },
  { query: 'Legends & Lattes by Travis Baldree', expect: 'book' },
  { query: 'The Invisible Life of Addie LaRue by V.E. Schwab', expect: 'book' },
  { query: 'The Ministry of Time by Kaliane Bradley', expect: 'book' },
  { query: 'The Husbands by Holly Gramazio', expect: 'book' },
  { query: 'Anxious People by Fredrik Backman', expect: 'book' },
  { query: 'A Man Called Ove by Fredrik Backman', expect: 'book' },
  { query: 'Beartown by Fredrik Backman', expect: 'book' },
  { query: 'Eleanor Oliphant Is Completely Fine by Gail Honeyman', expect: 'book' },
  { query: 'Little Fires Everywhere by Celeste Ng', expect: 'book' },
  { query: 'Everything I Never Told You by Celeste Ng', expect: 'book' },
  { query: 'The Kite Runner by Khaled Hosseini', expect: 'book' },
  { query: 'A Thousand Splendid Suns by Khaled Hosseini', expect: 'book' },
  { query: 'Memoirs of a Geisha by Arthur Golden', expect: 'book' },
  { query: 'Water for Elephants by Sara Gruen', expect: 'book' },
  { query: 'The Help by Kathryn Stockett', expect: 'book' },
  { query: 'The Goldfinch by Donna Tartt', expect: 'book' },
  { query: 'The Secret History by Donna Tartt', expect: 'book' },
  { query: 'If We Were Villains by M.L. Rio', expect: 'book' },
  { query: 'The Da Vinci Code by Dan Brown', expect: 'book' },
  { query: 'The Girl with the Dragon Tattoo by Stieg Larsson', expect: 'book' },
  { query: 'The Housemaid\'s Secret by Freida McFadden', expect: 'book' },
  { query: 'The Housemaid Is Watching by Freida McFadden', expect: 'book' },
  { query: 'Never Lie by Freida McFadden', expect: 'book' },
  { query: 'The Inmate by Freida McFadden', expect: 'book' },
  { query: 'The Teacher by Freida McFadden', expect: 'book' },
  { query: 'The Coworker by Freida McFadden', expect: 'book' },
  { query: 'The It Girl by Ruth Ware', expect: 'book' },
  { query: 'The Woman in Cabin 10 by Ruth Ware', expect: 'book' },
  { query: 'The Woman in the Window by A.J. Finn', expect: 'book' },
  { query: 'Behind Closed Doors by B.A. Paris', expect: 'book' },
  { query: 'The Last Thing He Told Me by Laura Dave', expect: 'book' },
  { query: 'First Lie Wins by Ashley Elston', expect: 'book' },
  { query: 'Rock Paper Scissors by Alice Feeney', expect: 'book' },
  { query: 'None of This Is True by Lisa Jewell', expect: 'book' },
  { query: 'Then She Was Gone by Lisa Jewell', expect: 'book' },
  { query: 'The Family Upstairs by Lisa Jewell', expect: 'book' },
  { query: 'Listen for the Lie by Amy Tintera', expect: 'book' },
  { query: 'The God of the Woods by Liz Moore', expect: 'book' },
  { query: 'All the Colors of the Dark by Chris Whitaker', expect: 'book' },
  { query: 'James by Percival Everett', expect: 'book' },
  { query: 'The Guest List by Lucy Foley', expect: 'book' },
  { query: 'The Paris Apartment by Lucy Foley', expect: 'book' },
  { query: 'Carrie Soto Is Back by Taylor Jenkins Reid', expect: 'book' },
  { query: 'One True Loves by Taylor Jenkins Reid', expect: 'book' },
  { query: 'Maybe in Another Life by Taylor Jenkins Reid', expect: 'book' },
  { query: 'Demon Copperhead by Barbara Kingsolver', expect: 'book' },
  { query: 'Remarkably Bright Creatures by Shelby Van Pelt', expect: 'book' },
  { query: 'The Measure by Nikki Erlick', expect: 'book' },
  { query: 'The Covenant of Water by Abraham Verghese', expect: 'book' },
  { query: 'Hello Beautiful by Ann Napolitano', expect: 'book' },
  { query: 'Mad Honey by Jodi Picoult', expect: 'book' },
  { query: 'My Sister\'s Keeper by Jodi Picoult', expect: 'book' },
  { query: 'Horse by Geraldine Brooks', expect: 'book' },
  { query: 'The Lincoln Highway by Amor Towles', expect: 'book' },
  { query: 'A Gentleman in Moscow by Amor Towles', expect: 'book' },
  { query: 'The Vanishing Half by Brit Bennett', expect: 'book' },
  { query: 'Such a Fun Age by Kiley Reid', expect: 'book' },
  { query: 'The Wedding People by Alison Espach', expect: 'book' },
  { query: 'Sandwich by Catherine Newman', expect: 'book' },
  { query: 'Intermezzo by Sally Rooney', expect: 'book' },
  { query: 'Beautiful World, Where Are You by Sally Rooney', expect: 'book' },
  { query: 'Tom Lake by Ann Patchett', expect: 'book' },
  { query: 'The Dutch House by Ann Patchett', expect: 'book' },
  { query: 'In Five Years by Rebecca Serle', expect: 'book' },
  { query: 'One Italian Summer by Rebecca Serle', expect: 'book' },
  { query: 'The Frozen River by Ariel Lawhon', expect: 'book' },
  { query: 'The Heaven & Earth Grocery Store by James McBride', expect: 'book' },
  { query: 'Blue Sisters by Coco Mellors', expect: 'book' },
  { query: 'Cleopatra and Frankenstein by Coco Mellors', expect: 'book' },
  { query: 'Martyr! by Kaveh Akbar', expect: 'book' },
  { query: 'Jane Eyre by Charlotte Bronte', expect: 'book' },
  { query: 'Anna Karenina by Leo Tolstoy', expect: 'book' },
  { query: 'Madame Bovary by Gustave Flaubert', expect: 'book' },
  { query: 'The Picture of Dorian Gray by Oscar Wilde', expect: 'book' },
  { query: 'Brave New World by Aldous Huxley', expect: 'book' },
  { query: '1984 by George Orwell', expect: 'book' },
  { query: 'The Catcher in the Rye by J.D. Salinger', expect: 'book' },
  { query: 'To Kill a Mockingbird by Harper Lee', expect: 'book' },
  { query: 'Of Mice and Men by John Steinbeck', expect: 'book' },
  { query: 'The Color Purple by Alice Walker', expect: 'book' },
  { query: 'Beloved by Toni Morrison', expect: 'book' },
  { query: 'One Hundred Years of Solitude by Gabriel Garcia Marquez', expect: 'book' },
  { query: 'The Unbearable Lightness of Being by Milan Kundera', expect: 'book' },
  { query: 'Tropic of Cancer by Henry Miller', expect: 'book' },
  { query: 'Fear of Flying by Erica Jong', expect: 'book' },
  { query: 'Delta of Venus by Anais Nin', expect: 'book' },
  { query: 'Flowers in the Attic by V.C. Andrews', expect: 'book' },
  { query: 'The Clan of the Cave Bear by Jean M. Auel', expect: 'book' },
  { query: 'The Thorn Birds by Colleen McCullough', expect: 'book' },
  { query: 'Gone with the Wind by Margaret Mitchell', expect: 'book' },
  { query: 'Rebecca by Daphne du Maurier', expect: 'book' },
  { query: 'The Time Traveler\'s Wife by Audrey Niffenegger', expect: 'book' },
  { query: 'Atonement by Ian McEwan', expect: 'book' },
  { query: 'American Psycho by Bret Easton Ellis', expect: 'book' },
  { query: 'The Godfather by Mario Puzo', expect: 'book' },
  { query: 'It by Stephen King', expect: 'book' },
  { query: 'Gerald\'s Game by Stephen King', expect: 'book' },
  { query: 'The Shining by Stephen King', expect: 'book' },

  // ============================================================
  // YA — the parent-checking use case (~80)
  // ============================================================
  { query: 'Forever by Judy Blume', expect: 'book' },
  { query: 'Are You There God? It\'s Me, Margaret by Judy Blume', expect: 'book' },
  { query: 'Looking for Alaska by John Green', expect: 'book' },
  { query: 'The Fault in Our Stars by John Green', expect: 'book' },
  { query: 'Paper Towns by John Green', expect: 'book' },
  { query: 'Turtles All the Way Down by John Green', expect: 'book' },
  { query: 'Thirteen Reasons Why by Jay Asher', expect: 'book' },
  { query: 'Speak by Laurie Halse Anderson', expect: 'book' },
  { query: 'The Perks of Being a Wallflower by Stephen Chbosky', expect: 'book' },
  { query: 'The Hate U Give by Angie Thomas', expect: 'book' },
  { query: 'All the Bright Places by Jennifer Niven', expect: 'book' },
  { query: 'Five Feet Apart by Rachael Lippincott', expect: 'book' },
  { query: 'Everything, Everything by Nicola Yoon', expect: 'book' },
  { query: 'The Sun Is Also a Star by Nicola Yoon', expect: 'book' },
  { query: 'To All the Boys I\'ve Loved Before by Jenny Han', expect: 'book' },
  { query: 'P.S. I Still Love You by Jenny Han', expect: 'book' },
  { query: 'The Summer I Turned Pretty by Jenny Han', expect: 'book' },
  { query: 'It\'s Not Summer Without You by Jenny Han', expect: 'book' },
  { query: 'We\'ll Always Have Summer by Jenny Han', expect: 'book' },
  { query: 'Better Than the Movies by Lynn Painter', expect: 'book' },
  { query: 'Nothing Like the Movies by Lynn Painter', expect: 'book' },
  { query: 'One of Us Is Lying by Karen M. McManus', expect: 'book' },
  { query: 'A Good Girl\'s Guide to Murder by Holly Jackson', expect: 'book' },
  { query: 'Good Girl, Bad Blood by Holly Jackson', expect: 'book' },
  { query: 'As Good as Dead by Holly Jackson', expect: 'book' },
  { query: 'Five Survive by Holly Jackson', expect: 'book' },
  { query: 'The Inheritance Games by Jennifer Lynn Barnes', expect: 'book' },
  { query: 'The Hawthorne Legacy by Jennifer Lynn Barnes', expect: 'book' },
  { query: 'The Final Gambit by Jennifer Lynn Barnes', expect: 'book' },
  { query: 'The Brothers Hawthorne by Jennifer Lynn Barnes', expect: 'book' },
  { query: 'Divergent by Veronica Roth', expect: 'book' },
  { query: 'Insurgent by Veronica Roth', expect: 'book' },
  { query: 'The Maze Runner by James Dashner', expect: 'book' },
  { query: 'Legend by Marie Lu', expect: 'book' },
  { query: 'Red Queen by Victoria Aveyard', expect: 'book' },
  { query: 'Shatter Me by Tahereh Mafi', expect: 'book' },
  { query: 'Ignite Me by Tahereh Mafi', expect: 'book' },
  { query: 'The Ballad of Songbirds and Snakes by Suzanne Collins', expect: 'book' },
  { query: 'Catching Fire by Suzanne Collins', expect: 'book' },
  { query: 'Mockingjay by Suzanne Collins', expect: 'book' },
  { query: 'New Moon by Stephenie Meyer', expect: 'book' },
  { query: 'Eclipse by Stephenie Meyer', expect: 'book' },
  { query: 'Breaking Dawn by Stephenie Meyer', expect: 'book' },
  { query: 'Midnight Sun by Stephenie Meyer', expect: 'book' },
  { query: 'City of Bones by Cassandra Clare', expect: 'book' },
  { query: 'City of Ashes by Cassandra Clare', expect: 'book' },
  { query: 'Clockwork Angel by Cassandra Clare', expect: 'book' },
  { query: 'Crown of Midnight by Sarah J. Maas', expect: 'book' },
  { query: 'Empire of Storms by Sarah J. Maas', expect: 'book' },
  { query: 'Kingdom of Ash by Sarah J. Maas', expect: 'book' },
  { query: 'The Wicked King by Holly Black', expect: 'book' },
  { query: 'The Queen of Nothing by Holly Black', expect: 'book' },
  { query: 'The Stolen Heir by Holly Black', expect: 'book' },
  { query: 'The Selection by Kiera Cass', expect: 'book' },
  { query: 'Anna and the French Kiss by Stephanie Perkins', expect: 'book' },
  { query: 'Fangirl by Rainbow Rowell', expect: 'book' },
  { query: 'Eleanor & Park by Rainbow Rowell', expect: 'book' },
  { query: 'We Were Liars by E. Lockhart', expect: 'book' },
  { query: 'Family of Liars by E. Lockhart', expect: 'book' },
  { query: 'They Both Die at the End by Adam Silvera', expect: 'book' },
  { query: 'What If It\'s Us by Becky Albertalli', expect: 'book' },
  { query: 'Simon vs. the Homo Sapiens Agenda by Becky Albertalli', expect: 'book' },
  { query: 'Heartstopper by Alice Oseman', expect: 'book' },
  { query: 'Nick and Charlie by Alice Oseman', expect: 'book' },
  { query: 'If He Had Been with Me by Laura Nowlin', expect: 'book' },
  { query: 'If Only I Had Told Her by Laura Nowlin', expect: 'book' },
  { query: 'Divine Rivals by Rebecca Ross', expect: 'book' },
  { query: 'Ruthless Vows by Rebecca Ross', expect: 'book' },
  { query: 'Lightlark by Alex Aster', expect: 'book' },
  { query: 'Nightbane by Alex Aster', expect: 'book' },
  { query: 'Belladonna by Adalyn Grace', expect: 'book' },
  { query: 'Foxglove by Adalyn Grace', expect: 'book' },
  { query: 'The Wrath and the Dawn by Renee Ahdieh', expect: 'book' },
  { query: 'An Ember in the Ashes by Sabaa Tahir', expect: 'book' },
  { query: 'The Giver by Lois Lowry', expect: 'book' },
  { query: 'The Outsiders by S.E. Hinton', expect: 'book' },
  { query: 'The Book Thief by Markus Zusak', expect: 'book' },
  { query: 'Percy Jackson The Lightning Thief by Rick Riordan', expect: 'book' },
  { query: 'Harry Potter and the Sorcerer\'s Stone by J.K. Rowling', expect: 'book' },
  { query: 'Eragon by Christopher Paolini', expect: 'book' },

  // ============================================================
  // Romance long-tail (~60, incl. 4 future-proof 2026 releases)
  // ============================================================
  { query: 'Heated Rivalry by Rachel Reid', expect: 'book' },
  { query: 'The Long Game by Rachel Reid', expect: 'book' },
  { query: 'The Mistake by Elle Kennedy', expect: 'book' },
  { query: 'The Score by Elle Kennedy', expect: 'book' },
  { query: 'The Goal by Elle Kennedy', expect: 'book' },
  { query: 'The Unhoneymooners by Christina Lauren', expect: 'book' },
  { query: 'Love and Other Words by Christina Lauren', expect: 'book' },
  { query: 'The Soulmate Equation by Christina Lauren', expect: 'book' },
  { query: 'The True Love Experiment by Christina Lauren', expect: 'book' },
  { query: 'The American Roommate Experiment by Elena Armas', expect: 'book' },
  { query: 'The Long Game by Elena Armas', expect: 'book' },
  { query: 'The Fiance Dilemma by Elena Armas', expect: 'book' },
  { query: 'Bride by Ali Hazelwood', expect: 'book' },
  { query: 'Problematic Summer Romance by Ali Hazelwood', expect: 'book' },
  { query: 'Hook, Line, and Sinker by Tessa Bailey', expect: 'book' },
  { query: 'Fangirl Down by Tessa Bailey', expect: 'book' },
  { query: 'Secretly Yours by Tessa Bailey', expect: 'book' },
  { query: 'Things We Left Behind by Lucy Score', expect: 'book' },
  { query: 'Powerless by Elsie Silver', expect: 'book' },
  { query: 'Wild Love by Elsie Silver', expect: 'book' },
  { query: 'Daydream by Hannah Grace', expect: 'book' },
  { query: 'The Rule Book by Sarah Adams', expect: 'book' },
  { query: 'Practice Makes Perfect by Sarah Adams', expect: 'book' },
  { query: 'Just for the Summer by Abby Jimenez', expect: 'book' },
  { query: 'The Friend Zone by Abby Jimenez', expect: 'book' },
  { query: 'This Summer Will Be Different by Carley Fortune', expect: 'book' },
  { query: 'Meet Me at the Lake by Carley Fortune', expect: 'book' },
  { query: 'Behind the Net by Stephanie Archer', expect: 'book' },
  { query: 'Consider Me by Becka Mack', expect: 'book' },
  { query: 'Mile High by Liz Tomforde', expect: 'book' },
  { query: 'The Right Move by Liz Tomforde', expect: 'book' },
  { query: 'Caught Up by Liz Tomforde', expect: 'book' },
  { query: 'Before I Let Go by Kennedy Ryan', expect: 'book' },
  { query: 'This Could Be Us by Kennedy Ryan', expect: 'book' },
  { query: 'Heart Bones by Colleen Hoover', expect: 'book' },
  { query: 'Regretting You by Colleen Hoover', expect: 'book' },
  { query: 'Scarred by Emily McIntire', expect: 'book' },
  { query: 'God of Malice by Rina Kent', expect: 'book' },
  { query: 'The Ritual by Shantel Tessier', expect: 'book' },
  { query: 'King of Sloth by Ana Huang', expect: 'book' },
  { query: 'American Queen by Sierra Simone', expect: 'book' },
  { query: 'Kill Switch by Penelope Douglas', expect: 'book' },
  { query: 'The Duke and I by Julia Quinn', expect: 'book' },
  { query: 'The Viscount Who Loved Me by Julia Quinn', expect: 'book' },
  { query: 'Romancing Mister Bridgerton by Julia Quinn', expect: 'book' },
  { query: 'When He Was Wicked by Julia Quinn', expect: 'book' },
  { query: 'Devil in Winter by Lisa Kleypas', expect: 'book' },
  { query: 'Kulti by Mariana Zapata', expect: 'book' },
  { query: 'From Lukov with Love by Mariana Zapata', expect: 'book' },
  { query: 'The Kiss Quotient by Helen Hoang', expect: 'book' },
  { query: 'Beautiful Disaster by Jamie McGuire', expect: 'book' },
  { query: 'After by Anna Todd', expect: 'book' },
  { query: 'The Idea of You by Robinne Lee', expect: 'book' },
  { query: 'Fifty Shades Darker by E.L. James', expect: 'book' },
  { query: 'Fifty Shades Freed by E.L. James', expect: 'book' },
  { query: 'A Court of Frost and Starlight by Sarah J. Maas', expect: 'book' },
  // Future-proofing: 2026 releases, expected known:false for now.
  { query: 'The Traitor\'s Son by Veronica Roth', expect: 'book' },
  { query: 'Starside by Alex Aster', expect: 'book' },
  { query: 'Lightwing by Caroline Peckham', expect: 'book' },
  { query: 'Prince of Swords by Elise Kova', expect: 'book' },

  // ============================================================
  // Movies (~20)
  // ============================================================
  { query: 'Fifty Shades Freed 2018 film', expect: 'movie' },
  { query: 'After We Collided 2020 film', expect: 'movie' },
  { query: 'Gone Girl 2014 film', expect: 'movie' },
  { query: 'The Wolf of Wall Street 2013 film', expect: 'movie' },
  { query: 'Blue Valentine 2010 film', expect: 'movie' },
  { query: 'Shame 2011 film', expect: 'movie' },
  { query: 'Brokeback Mountain 2005 film', expect: 'movie' },
  { query: 'Secretary 2002 film', expect: 'movie' },
  { query: 'Cruel Intentions 1999 film', expect: 'movie' },
  { query: 'Wild Things 1998 film', expect: 'movie' },
  { query: 'American Pie 1999 film', expect: 'movie' },
  { query: 'Deadpool 2016 film', expect: 'movie' },
  { query: 'Dirty Dancing 1987 film', expect: 'movie' },
  { query: 'Pretty Woman 1990 film', expect: 'movie' },
  { query: 'Oppenheimer 2023 film', expect: 'movie' },
  { query: 'Barbie 2023 film', expect: 'movie' },
  { query: 'Wicked 2024 film', expect: 'movie' },
  { query: 'Anora 2024 film', expect: 'movie' },
  { query: 'The Substance 2024 film', expect: 'movie' },
  { query: 'Sinners 2025 film', expect: 'movie' },

  // ============================================================
  // TV (~20)
  // ============================================================
  { query: 'Yellowstone Paramount series', expect: 'tv' },
  { query: 'The Summer I Turned Pretty Amazon series', expect: 'tv' },
  { query: 'My Life with the Walter Boys Netflix series', expect: 'tv' },
  { query: 'Ginny & Georgia Netflix series', expect: 'tv' },
  { query: 'XO, Kitty Netflix series', expect: 'tv' },
  { query: 'Never Have I Ever Netflix series', expect: 'tv' },
  { query: 'Elite Netflix series', expect: 'tv' },
  { query: 'Outer Banks Netflix series', expect: 'tv' },
  { query: 'The Sex Lives of College Girls HBO series', expect: 'tv' },
  { query: 'House of the Dragon HBO series', expect: 'tv' },
  { query: 'The Witcher Netflix series', expect: 'tv' },
  { query: 'The Boys Amazon series', expect: 'tv' },
  { query: 'True Blood HBO series', expect: 'tv' },
  { query: 'Shameless Showtime series', expect: 'tv' },
  { query: 'Grey\'s Anatomy ABC series', expect: 'tv' },
  { query: 'The Vampire Diaries CW series', expect: 'tv' },
  { query: 'One Day Netflix series', expect: 'tv' },
  { query: 'Nobody Wants This Netflix series', expect: 'tv' },
  { query: 'The Perfect Couple Netflix series', expect: 'tv' },
  { query: 'Rivals Hulu series', expect: 'tv' },
];

async function seed() {
  let ok = 0, unknown = 0, skipped = 0, failed = 0;
  for (const [i, { query, expect }] of SEED.entries()) {
    console.log(`\n[${i + 1}/${SEED.length}] → ${query}  (expecting ${expect})`);
    try {
      const { candidates } = await runDisambiguate(query);
      if (candidates.length === 0) {
        console.log('  ✗ No candidates returned by Claude');
        skipped++;
        continue;
      }
      const match = candidates.find((c) => c.medium === expect) ?? candidates[0];
      if (match.medium !== expect) {
        console.log(`  ⚠ Best match is ${match.medium}, expected ${expect}. Proceeding with ${match.title}.`);
      }
      console.log(`  matched: ${match.title} (${match.creator}, ${match.year}, ${match.medium}) → ${match.slug}`);
      const result = await runRate({ slug: match.slug, candidate: match });
      if (result.rating.known) {
        console.log(`  ✓ ${result.rating.score}/10 — ${result.rating.verdict}${result.cacheHit ? ' (cached)' : ''}`);
        ok++;
      } else {
        console.log('  ⚠ Claude returned known=false');
        unknown++;
      }
    } catch (err) {
      console.error('  ✗ Error:', err instanceof Error ? err.message : err);
      failed++;
    }
  }
  console.log(`\n=== Done — ok: ${ok}, unknown: ${unknown}, skipped: ${skipped}, failed: ${failed} ===`);
}

seed().then(() => process.exit(0));
