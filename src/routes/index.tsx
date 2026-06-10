import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Minus, Trash2, UserPlus, Ban, AlertTriangle } from "lucide-react";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/")({
  component: Index,
});

type Strike = { id: string; word: string; timestamp: number };
type Member = { id: string; name: string; color: string; strikes: Strike[] };
type State = { members: Member[]; words: string[] };

const STORAGE_KEY = "boese-woerter-v1";
const DEFAULT_WORDS = ["Scheiße", "Arsch", "Idiot", "Verdammt"];
const COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b"];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const LIMIT = 10;

function load(): State {
  if (typeof window === "undefined") return { members: [], words: DEFAULT_WORDS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { members: [], words: DEFAULT_WORDS };
}

function strikesThisWeek(m: Member) {
  const cutoff = Date.now() - WEEK_MS;
  return m.strikes.filter((s) => s.timestamp >= cutoff).length;
}

function Index() {
  const [state, setState] = useState<State>({ members: [], words: DEFAULT_WORDS });
  const [hydrated, setHydrated] = useState(false);
  const [newName, setNewName] = useState("");
  const [newWord, setNewWord] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [wordsOpen, setWordsOpen] = useState(false);
  const [strikeMember, setStrikeMember] = useState<Member | null>(null);
  const [historyMember, setHistoryMember] = useState<Member | null>(null);

  useEffect(() => {
    setState(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const addMember = () => {
    const name = newName.trim();
    if (!name) return;
    if (state.members.length >= 4) {
      toast.error("Maximal 4 Familienmitglieder");
      return;
    }
    const color = COLORS[state.members.length];
    setState((s) => ({
      ...s,
      members: [...s.members, { id: crypto.randomUUID(), name, color, strikes: [] }],
    }));
    setNewName("");
    setAddOpen(false);
  };

  const removeMember = (id: string) => {
    setState((s) => ({ ...s, members: s.members.filter((m) => m.id !== id) }));
  };

  const addStrike = (memberId: string, word: string) => {
    setState((s) => {
      const next = {
        ...s,
        members: s.members.map((m) =>
          m.id === memberId
            ? {
                ...m,
                strikes: [
                  ...m.strikes,
                  { id: crypto.randomUUID(), word, timestamp: Date.now() },
                ],
              }
            : m,
        ),
      };
      const updated = next.members.find((m) => m.id === memberId)!;
      const count = strikesThisWeek(updated);
      if (count === LIMIT) {
        toast.error(`${updated.name}: 10 Striche! 📵 1 Woche Handyverbot!`, { duration: 6000 });
      } else if (count > LIMIT) {
        toast.warning(`${updated.name} hat ${count} Striche diese Woche.`);
      } else {
        toast(`Strich für ${updated.name} (${word})`, {
          description: `${count}/${LIMIT} diese Woche`,
        });
      }
      return next;
    });
    setStrikeMember(null);
  };

  const removeLastStrike = (memberId: string) => {
    setState((s) => ({
      ...s,
      members: s.members.map((m) =>
        m.id === memberId ? { ...m, strikes: m.strikes.slice(0, -1) } : m,
      ),
    }));
  };

  const removeStrike = (memberId: string, strikeId: string) => {
    setState((s) => ({
      ...s,
      members: s.members.map((m) =>
        m.id === memberId ? { ...m, strikes: m.strikes.filter((x) => x.id !== strikeId) } : m,
      ),
    }));
    setHistoryMember((hm) =>
      hm && hm.id === memberId
        ? { ...hm, strikes: hm.strikes.filter((x) => x.id !== strikeId) }
        : hm,
    );
  };

  const clearWeek = (memberId: string) => {
    const cutoff = Date.now() - WEEK_MS;
    setState((s) => ({
      ...s,
      members: s.members.map((m) =>
        m.id === memberId ? { ...m, strikes: m.strikes.filter((x) => x.timestamp < cutoff) } : m,
      ),
    }));
    setHistoryMember(null);
    toast.success("Striche dieser Woche gelöscht");
  };

  const addWord = () => {
    const w = newWord.trim();
    if (!w) return;
    if (state.words.includes(w)) return;
    setState((s) => ({ ...s, words: [...s.words, w] }));
    setNewWord("");
  };

  const removeWord = (w: string) => {
    setState((s) => ({ ...s, words: s.words.filter((x) => x !== w) }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white pb-24">
      <Toaster position="top-center" theme="dark" richColors />

      <header className="px-5 pt-8 pb-6">
        <h1 className="text-3xl font-black tracking-tight">Böse Wörter</h1>
        <p className="text-slate-400 text-sm mt-1">
          10 Striche / Woche = 📵 1 Woche Handyverbot
        </p>
      </header>

      <main className="px-5 space-y-4">
        {state.members.length === 0 && hydrated && (
          <Card className="bg-slate-800/50 border-slate-700 text-white">
            <CardContent className="py-10 text-center text-slate-400">
              Noch keine Familienmitglieder. Tippe unten auf „Hinzufügen".
            </CardContent>
          </Card>
        )}

        {state.members.map((m) => {
          const count = strikesThisWeek(m);
          const banned = count >= LIMIT;
          return (
            <Card
              key={m.id}
              className="bg-slate-800/70 border-slate-700 text-white overflow-hidden"
              style={{ borderLeft: `6px solid ${m.color}` }}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {m.name}
                  {banned && (
                    <Badge variant="destructive" className="gap-1">
                      <Ban className="h-3 w-3" /> Handyverbot
                    </Badge>
                  )}
                </CardTitle>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-slate-400 hover:text-red-400"
                  onClick={() => removeMember(m.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2 mb-3">
                  <span
                    className={`text-5xl font-black ${
                      banned ? "text-red-500" : count >= 7 ? "text-amber-400" : "text-white"
                    }`}
                  >
                    {count}
                  </span>
                  <span className="text-slate-400 text-sm">/ {LIMIT} diese Woche</span>
                </div>

                <TallyMarks count={count} color={m.color} />

                <div className="flex gap-2 mt-4">
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold"
                    onClick={() => setStrikeMember(m)}
                  >
                    <Plus className="h-5 w-5 mr-1" /> Strich
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    title="Letzten Strich entfernen"
                    className="border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-white"
                    onClick={() => removeLastStrike(m.id)}
                    disabled={m.strikes.length === 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    title="Verlauf"
                    className="border-slate-600 bg-slate-700/50 hover:bg-slate-700 text-white"
                    onClick={() => setHistoryMember(m)}
                    disabled={m.strikes.length === 0}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>

                {count >= 7 && !banned && (
                  <div className="mt-3 flex items-center gap-2 text-amber-400 text-xs">
                    <AlertTriangle className="h-4 w-4" />
                    Noch {LIMIT - count} Striche bis zum Handyverbot!
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </main>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur border-t border-slate-700 p-3 flex gap-2">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button
              className="flex-1 bg-white text-slate-900 hover:bg-slate-200 font-semibold"
              disabled={state.members.length >= 4}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Hinzufügen ({state.members.length}/4)
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle>Familienmitglied hinzufügen</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Name"
              value={newName}
              maxLength={20}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMember()}
              className="bg-slate-800 border-slate-700"
            />
            <DialogFooter>
              <Button onClick={addMember}>Hinzufügen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={wordsOpen} onOpenChange={setWordsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
              Wörter
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle>Böse Wörter verwalten</DialogTitle>
            </DialogHeader>
            <div className="flex gap-2">
              <Input
                placeholder="Neues Wort"
                value={newWord}
                maxLength={30}
                onChange={(e) => setNewWord(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addWord()}
                className="bg-slate-800 border-slate-700"
              />
              <Button onClick={addWord}>+</Button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
              {state.words.map((w) => (
                <Badge
                  key={w}
                  variant="secondary"
                  className="bg-slate-700 text-white gap-1 py-1.5 px-3"
                >
                  {w}
                  <button onClick={() => removeWord(w)} className="ml-1 text-slate-400 hover:text-red-400">
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Word picker dialog */}
      <Dialog open={!!strikeMember} onOpenChange={(o) => !o && setStrikeMember(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Welches Wort? — {strikeMember?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {state.words.map((w) => (
              <Button
                key={w}
                variant="outline"
                className="border-slate-600 bg-slate-800 text-white hover:bg-red-600 hover:border-red-600 h-12"
                onClick={() => strikeMember && addStrike(strikeMember.id, w)}
              >
                {w}
              </Button>
            ))}
            <Button
              variant="outline"
              className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700 h-12 col-span-2"
              onClick={() => strikeMember && addStrike(strikeMember.id, "Sonstiges")}
            >
              Sonstiges
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TallyMarks({ count, color }: { count: number; color: string }) {
  const display = Math.min(count, LIMIT);
  const groups = Math.floor(display / 5);
  const remainder = display % 5;
  return (
    <div className="flex flex-wrap gap-3 min-h-[28px]">
      {Array.from({ length: groups }).map((_, i) => (
        <TallyGroup key={i} n={5} color={color} />
      ))}
      {remainder > 0 && <TallyGroup n={remainder} color={color} />}
      {count > LIMIT && (
        <span className="text-red-400 text-sm font-bold self-center">+{count - LIMIT}</span>
      )}
    </div>
  );
}

function TallyGroup({ n, color }: { n: number; color: string }) {
  return (
    <svg width="32" height="28" viewBox="0 0 32 28" className="shrink-0">
      {Array.from({ length: Math.min(n, 4) }).map((_, i) => (
        <line
          key={i}
          x1={4 + i * 6}
          y1="2"
          x2={4 + i * 6}
          y2="26"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
      ))}
      {n === 5 && (
        <line x1="0" y1="22" x2="28" y2="4" stroke={color} strokeWidth="3" strokeLinecap="round" />
      )}
    </svg>
  );
}
