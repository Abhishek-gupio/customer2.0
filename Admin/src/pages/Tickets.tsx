import { useEffect, useMemo, useState, useRef } from 'react';
import { Search, Ticket, MessageSquare, Send, CheckCircle2, Clock, ChevronLeft, ShieldCheck } from 'lucide-react';
import { adminApi, type SupportTicketListItem, type TicketStatus, type TicketMessage } from '../api/client';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { cn } from '../lib/cn';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../lib/socket';

export default function Tickets() {
  const { admin } = useAuth();
  const [tickets, setTickets] = useState<SupportTicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'OPEN' | 'CLOSED'>('OPEN');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [ticketLoading, setTicketLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const isSupport = admin?.role === 'SUPPORT';

  useEffect(() => {
    fetchTickets();

    // Listen for real-time updates
    const socket = getSocket();
    if (admin?.id) {
      socket.emit('join', admin.id);
    }

    socket.on('new_support_message', (data: { packet: TicketMessage }) => {
      if (selectedTicketId === data.packet.ticketId) {
        setMessages(prev => [...prev, data.packet]);
      }
      setTickets(prev => prev.map(t =>
        t.id === data.packet.ticketId
          ? { ...t, _count: { ...t._count, messages: t._count.messages + 1 }, updatedAt: new Date().toISOString() }
          : t
      ));
    });

    socket.on('ticket_status_updated', (data: { ticketId: string, status: TicketStatus }) => {
      setTickets(prev => prev.map(t => t.id === data.ticketId ? { ...t, status: data.status } : t));
    });

    return () => {
      socket.off('new_support_message');
      socket.off('ticket_status_updated');
    };
  }, [selectedTicketId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchTickets = async () => {
    setLoading(true);
    const res = await adminApi.listTickets({ limit: 100 });
    setLoading(false);
    if (res.success) setTickets(res.data.data);
  };

  const fetchMessages = async (id: string) => {
    setTicketLoading(true);
    const res = await adminApi.getTicketMessages(id);
    setTicketLoading(false);
    if (res.success) setMessages(res.data);
  };

  const handleTicketSelect = (id: string) => {
    setSelectedTicketId(id);
    setMessages([]);
    fetchMessages(id);
  };

  const activeTicket = useMemo(() =>
    tickets.find(t => t.id === selectedTicketId),
    [tickets, selectedTicketId]);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesSearch = t.subject.toLowerCase().includes(search.toLowerCase()) ||
        t.customer?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        t.customer?.phoneNumber?.includes(search);
      const matchesTab = (activeTab === 'OPEN' && t.status !== 'CLOSED' && t.status !== 'RESOLVED') ||
        (activeTab === 'CLOSED' && (t.status === 'CLOSED' || t.status === 'RESOLVED'));
      return matchesSearch && matchesTab;
    });
  }, [tickets, search, activeTab]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !selectedTicketId || sending) return;

    setSending(true);
    const res = await adminApi.addTicketMessage(selectedTicketId, newMessage.trim());
    setSending(false);

    if (res.success) {
      setNewMessage('');
      setMessages(prev => [...prev, res.data]);
    }
  };

  const handleStatusChange = async (status: TicketStatus) => {
    if (!selectedTicketId || sending) return;
    setSending(true);
    const res = await adminApi.updateTicketStatus(selectedTicketId, status);
    setSending(false);
    if (res.success) {
      setTickets(prev => prev.map(t => t.id === selectedTicketId ? { ...t, status } : t));
    } else {
      alert("Failed to update status. Please try again.");
    }
  };

  // --- SUPPORT VIEW: Dual-Pane Chat ---
  const renderSupportView = () => (
    <div className="flex-1 h-full flex flex-col lg:flex-row gap-6 items-start animate-in fade-in duration-500 overflow-hidden min-h-0">
      {/* Sidebar: Ticket List */}
      <div className={cn(
        "flex flex-col h-full bg-[#0c0c0c] border border-white/[0.08] rounded-3xl overflow-hidden transition-all duration-300",
        selectedTicketId ? "hidden lg:flex w-full lg:w-[400px]" : "flex w-full lg:w-[400px]"
      )}>
        <div className="p-5 border-b border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white tracking-tight">Support Center</h2>
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-all"
            />
          </div>

          <div className="flex p-1 bg-white/[0.03] rounded-xl border border-white/[0.05]">
            <button onClick={() => setActiveTab('OPEN')} className={cn("flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all", activeTab === 'OPEN' ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60")}>Active</button>
            <button onClick={() => setActiveTab('CLOSED')} className={cn("flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all", activeTab === 'CLOSED' ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60")}>Resolved</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 mx-2 my-1 rounded-2xl bg-white/[0.02] animate-pulse border border-white/[0.05]" />
            ))
          ) : filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-white/30 space-y-2">
              <MessageSquare className="h-8 w-8 opacity-20" />
              <p className="text-sm font-medium">No tickets found</p>
            </div>
          ) : (
            filteredTickets.map((t) => (
              <button
                key={t.id}
                onClick={() => { setSelectedTicketId(t.id); fetchMessages(t.id); }}
                className={cn(
                  "w-full text-left p-4 rounded-2xl transition-all border group relative",
                  selectedTicketId === t.id ? "bg-white/[0.06] border-white/10 shadow-lg" : "bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/[0.05]"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[14px] font-bold text-white truncate capitalize">{t.subject}</span>
                  <span className={cn("text-[10px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-md", t.status === 'OPEN' ? "bg-emerald-500/10 text-emerald-500" : t.status === 'IN_PROGRESS' ? "bg-blue-500/10 text-blue-500" : "bg-white/10 text-white/40")}>{t.status}</span>
                </div>
                <p className="text-[12px] text-white/50 line-clamp-1 mt-1 font-medium">{t.customer?.fullName || t.customer?.phoneNumber}</p>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-white/30 font-semibold uppercase tracking-wider"><Clock className="h-3 w-3" />{new Date(t.updatedAt).toLocaleDateString()}</div>
                  <div className="flex items-center gap-1 text-[11px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full"><MessageSquare className="h-3 w-3" />{t._count.messages}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={cn("flex-1 h-full flex flex-col bg-[#0c0c0c] border border-white/[0.08] rounded-3xl overflow-hidden relative", !selectedTicketId && "hidden lg:flex")}>
        {!selectedTicketId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
            <div className="h-20 w-20 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-6 shadow-2xl"><Ticket className="h-10 w-10 text-white/20" /></div>
            <h3 className="text-2xl font-black text-white tracking-tight">Select a Ticket</h3>
            <p className="text-white/40 max-w-[300px] mt-2 font-medium">Choose a conversation from the sidebar to start providing support in real-time.</p>
          </div>
        ) : (
          <>
            <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02] backdrop-blur-md sticky top-0 z-20">
              <div className="flex items-center gap-4">
                <button onClick={() => setSelectedTicketId(null)} className="lg:hidden h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center text-white"><ChevronLeft className="h-5 w-5" /></button>
                <div>
                  <h3 className="text-[17px] font-black text-white leading-none capitalize">{activeTicket?.subject}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] font-bold text-white/40 bg-white/5 px-2 py-0.5 rounded-md uppercase tracking-widest">{activeTicket?.category}</span>
                    <span className="text-white/20">•</span>
                    <span className="text-[12px] font-semibold text-white/60">{activeTicket?.customer?.fullName || activeTicket?.customer?.phoneNumber}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeTicket?.status === 'RESOLVED' || activeTicket?.status === 'CLOSED' ? (
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"><CheckCircle2 className="h-4 w-4 text-emerald-500" /><span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Ticket Resolved</span></div>
                ) : (
                  <Button variant="secondary" size="sm" disabled={sending} onClick={() => handleStatusChange('RESOLVED')} className="h-9 px-4 rounded-xl border-white/10 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20">{sending ? <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}Close Ticket</Button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.02),transparent_40%)]">
              {ticketLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-white/30"><div className="h-6 w-6 border-2 border-white/20 border-t-white rounded-full animate-spin" /><span className="text-xs font-bold uppercase tracking-widest">Loading History</span></div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-white/20 font-bold uppercase tracking-widest text-[10px]">No messages in this ticket history.</div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderRole !== 'CUSTOMER';
                  return (
                    <div key={msg.id} className={cn("flex flex-col animate-in fade-in slide-in-from-bottom-2", isMe ? "items-end" : "items-start")}>
                      <div className={cn("max-w-[80%] rounded-2xl px-5 py-3.5 text-sm font-medium leading-relaxed shadow-xl", isMe ? "bg-white text-black rounded-tr-none" : "bg-white/[0.05] border border-white/[0.08] text-white rounded-tl-none")}>{msg.content}</div>
                      <div className="mt-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/30">{isMe ? 'SUPPORT' : 'CUSTOMER'}<span>•</span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="p-6 bg-white/[0.02] border-t border-white/[0.08]">
              {activeTicket?.status === 'RESOLVED' || activeTicket?.status === 'CLOSED' ? (
                <div className="flex items-center justify-center gap-3 p-4 bg-emerald-500/[0.03] border border-emerald-500/10 rounded-2xl text-emerald-500/60"><CheckCircle2 className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-widest">Conversation Finalized - Read Only</span></div>
              ) : (
                <form onSubmit={handleSend} className="relative group">
                  <textarea rows={1} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Type your response..." className="w-full bg-[#111] border border-white/[0.1] rounded-2xl py-4 pl-5 pr-24 text-[15px] font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 focus:ring-4 focus:ring-white/[0.02] transition-all resize-none shadow-inner" />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <Button type="submit" size="sm" disabled={!newMessage.trim() || sending} className="h-10 px-5 rounded-xl bg-white text-black hover:bg-white/90 shadow-xl transition-all active:scale-[0.98]">{sending ? <div className="h-4 w-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> : <Send className="h-4 w-4" />}</Button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  // --- ADMIN VIEW: Table Format (Matching Customers Page) ---
  const renderAdminView = () => (
    <div className="flex-1 min-h-0 flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Support Management</h1>
          <p className="text-sm text-white/60">Global oversight of all platform tickets and customer queries</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group w-full sm:w-[300px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 group-focus-within:text-white/60 transition-colors" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl py-2.5 pl-11 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 transition-all"
            />
          </div>
        </div>
      </div>

      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-red-400" />
            Active Tickets
          </CardTitle>
          <CardDescription>
            {loading ? '---' : `${tickets.length} total tickets`} · Showing {filteredTickets.length} results
            <div className="flex mt-3 p-1 bg-white/[0.03] rounded-xl border border-white/[0.05] w-fit">
              <button onClick={() => setActiveTab('OPEN')} className={cn("px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", activeTab === 'OPEN' ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60")}>Active</button>
              <button onClick={() => setActiveTab('CLOSED')} className={cn("px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all", activeTab === 'CLOSED' ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60")}>Resolved</button>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-[#0c0c0e]">
                <tr className="border-b border-white/[0.07] text-[10px] font-black uppercase tracking-widest text-white/50 bg-[#111]">
                  <th className="px-6 py-4">Ticket</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Priority</th>
                  <th className="px-6 py-4">Messages</th>
                  <th className="px-6 py-4">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-6 py-6"><div className="h-4 bg-white/5 rounded-full w-full" /></td>
                    </tr>
                  ))
                ) : filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4 text-white/20">
                        <Ticket className="h-12 w-12 opacity-10" />
                        <p className="font-bold uppercase tracking-widest text-xs">No tickets matched your filters</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map((t) => {
                    const isSuperAdmin = admin?.role === 'SUPER_ADMIN';
                    return (
                      <tr
                        key={t.id}
                        className={cn(
                          "group transition-colors",
                          isSuperAdmin ? "cursor-default opacity-80" : "cursor-pointer hover:bg-white/[0.02]",
                          selectedTicketId === t.id && "bg-white/[0.05]"
                        )}
                        onClick={() => !isSuperAdmin && handleTicketSelect(t.id)}
                      >
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-white group-hover:text-red-400 transition-colors capitalize">{t.subject}</span>
                            <span className="text-[11px] font-bold text-white/20 uppercase tracking-widest mt-0.5">{t.category}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 overflow-hidden rounded-full bg-white/[0.03] ring-1 ring-white/10 flex items-center justify-center text-[10px] font-black text-white/40">
                              {t.customer?.fullName?.[0] || 'U'}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-white/80">{t.customer?.fullName || 'Anonymous'}</span>
                              <span className="text-[10px] text-white/30 font-medium">{t.customer?.phoneNumber}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "h-1.5 w-1.5 rounded-full shrink-0",
                              t.status === 'OPEN' ? "bg-emerald-500 shadow-[0_0_4px_#10b981]" :
                                t.status === 'IN_PROGRESS' ? "bg-blue-500 shadow-[0_0_4px_#3b82f6]" :
                                  "bg-white/20"
                            )} />
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border",
                              t.status === 'OPEN' ? "bg-emerald-500/5 text-emerald-500 border-emerald-500/10" :
                                t.status === 'IN_PROGRESS' ? "bg-blue-500/5 text-blue-500 border-blue-500/10" :
                                  "bg-white/5 text-white/40 border-white/5"
                            )}>
                              {t.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border",
                            t.priority === 'HIGH' || t.priority === 'URGENT' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                              t.priority === 'MEDIUM' ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                                "bg-white/5 text-white/40 border-white/5"
                          )}>
                            {t.priority}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-3.5 w-3.5 text-white/30" />
                            <span className="text-xs font-bold text-white/60">{t._count.messages}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-[11px] text-white/40 font-semibold">{new Date(t.createdAt).toLocaleDateString()}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* --- ADMIN CHAT FULL-SCREEN MODAL --- */}
      {selectedTicketId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-6">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xl animate-in fade-in duration-500"
            onClick={() => setSelectedTicketId(null)}
          />

          {/* Compact Centered Card Content */}
          <div className="relative w-full max-w-xl h-auto max-h-[85vh] bg-[#0c0c0e] border border-white/[0.08] rounded-[2rem] shadow-[0_64px_128px_-24px_rgba(0,0,0,1)] z-50 animate-in zoom-in-95 duration-300 flex flex-col overflow-hidden">
            {/* Compact Header */}
            <div className="p-6 border-b border-white/[0.1] flex items-center justify-between bg-black/40 backdrop-blur-2xl shrink-0">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSelectedTicketId(null)}
                  className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all shadow-xl"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div>
                  <h2 className="text-lg font-black text-white capitalize tracking-tight line-clamp-1">{activeTicket?.subject}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1 w-1 rounded-full bg-red-500 shadow-[0_0_4px_#ef4444]" />
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">{activeTicket?.category} • OVERSIGHT</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Compact Chat Body */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.035),transparent_60%)] flex flex-col min-h-0">
              <div className="flex-1 max-w-full mx-auto w-full">
                {ticketLoading ? (
                  <div className="flex flex-col items-center justify-center h-[40vh] gap-4">
                    <div className="h-10 w-10 border-2 border-white/10 border-t-red-500 rounded-full animate-spin" />
                    <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/20">Syncing Intelligence</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[40vh] text-white/[0.02] font-black uppercase tracking-[0.6em] text-[13px]">
                    <MessageSquare className="h-16 w-16 mb-8 opacity-20" />
                    History Empty
                  </div>
                ) : (
                  <div className="space-y-6 py-2">
                    {messages.map((msg) => {
                      const isMe = msg.senderRole !== 'CUSTOMER';
                      return (
                        <div key={msg.id} className={cn("flex flex-col transition-all", isMe ? "items-end" : "items-start group/msg")}>
                          <div className={cn(
                            "max-w-[85%] rounded-[1.5rem] px-5 py-3 text-[14px] font-medium leading-relaxed shadow-xl border transition-all",
                            isMe
                              ? "bg-red-500 text-white border-red-400/20 rounded-tr-none"
                              : "bg-white/[0.04] border-white/[0.08] text-white/90 rounded-tl-none hover:bg-white/[0.06]"
                          )}>
                            {msg.content}
                          </div>
                          <div className="mt-2.5 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-white/40 mx-4 opacity-70 group-hover/msg:opacity-100 transition-opacity">
                            {isMe ? 'OPERATOR' : 'CLIENT'}
                            <span className="opacity-40">•</span>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Compact Management Interface */}
            <div className="p-6 bg-black/60 border-t border-white/[0.1] backdrop-blur-3xl shrink-0">
              {admin?.role === 'ADMIN' ? (
                <div className="flex flex-col items-center gap-4">
                  {(activeTicket?.status === 'RESOLVED' || activeTicket?.status === 'CLOSED') && (
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500/60 transition-all">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span className="text-[9px] font-black uppercase tracking-[0.3em]">Resolved Archive</span>
                    </div>
                  )}
                  <div className="w-full p-6 bg-white/[0.02] border border-white/[0.05] rounded-[1.5rem] flex items-center justify-center gap-4 text-white/20 shadow-2xl">
                    <ShieldCheck className="h-5 w-5 opacity-30 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[12px] font-black uppercase tracking-[0.4em] text-white/40">Observation Mode</span>
                      <span className="text-[9px] items-center uppercase tracking-widest text-white/10 mt-0.5">Messaging restricted to Super Admin</span>
                    </div>
                  </div>
                </div>
              ) : (admin?.role !== 'SUPER_ADMIN' && (activeTicket?.status === 'RESOLVED' || activeTicket?.status === 'CLOSED')) ? (
                <div className="flex flex-col items-center justify-center py-6 text-emerald-500/40 gap-4">
                  <div className="h-12 w-12 rounded-full border border-emerald-500/20 flex items-center justify-center bg-emerald-500/5">
                    <CheckCircle2 className="h-6 w-6 opacity-60" />
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[13px] font-black uppercase tracking-[0.4em] text-emerald-500/60 text-center">Finalized Transmission</span>
                    <p className="text-[9px] uppercase tracking-[0.2em] mt-2 opacity-30 text-center">Session closed by admin</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSend} className="max-w-full mx-auto w-full relative group">
                  <textarea
                    rows={1}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder={activeTicket?.status === 'RESOLVED' ? "Executive Override Active..." : "Dispatch directive..."}
                    className={cn(
                      "w-full bg-white/[0.04] border border-white/[0.15] rounded-[1.5rem] py-5 pl-8 pr-24 text-[15px] font-medium text-white placeholder:text-white/10 focus:outline-none focus:ring-[12px] transition-all shadow-3xl min-h-[61px]",
                      activeTicket?.status === 'RESOLVED' ? "border-emerald-500/30 focus:border-emerald-500/50 focus:ring-emerald-500/5" : "focus:border-red-500 focus:ring-red-500/5"
                    )}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Button
                      type="submit"
                      size="lg"
                      disabled={!newMessage.trim() || sending}
                      className={cn(
                        "h-12 w-16 rounded-[1.25rem] text-white shadow-2xl transition-all active:scale-95 flex items-center justify-center p-0",
                        activeTicket?.status === 'RESOLVED' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/40" : "bg-red-500 hover:bg-red-600 shadow-red-500/40"
                      )}
                    >
                      {sending ? <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Send className="h-5 w-5" />}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return isSupport ? renderSupportView() : renderAdminView();
}
