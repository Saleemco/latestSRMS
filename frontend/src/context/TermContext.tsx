import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { termService, Term, Session } from '../services/term.service';

interface TermContextType {
  selectedTerm: Term | null;
  setSelectedTerm: (term: Term | null) => void;
  selectedSession: Session | null;
  setSelectedSession: (session: Session | null) => void;
  terms: Term[];
  sessions: Session[];
  activeTerm: Term | null;
  activeSession: Session | null;
  isLoading: boolean;
  refreshTerms: () => Promise<void>;
  refreshSessions: () => Promise<void>;
}

const TermContext = createContext<TermContextType | undefined>(undefined);

export const TermProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedTerm, setSelectedTerm] = useState<Term | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [terms, setTerms] = useState<Term[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeTerm, setActiveTerm] = useState<Term | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  // Load terms when selectedSession changes
  useEffect(() => {
    if (selectedSession?.id) {
      console.log('🔄 Loading terms for session:', selectedSession.name);
      loadTerms(selectedSession.id);
    }
  }, [selectedSession?.id]);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      console.log('🔍 Loading sessions...');
      const sessionsData = await termService.getAllSessions();
      console.log('📊 Sessions loaded:', sessionsData.length);
      setSessions(sessionsData);
      
      // Find active session
      const activeSessionData = sessionsData.find(s => s.isActive);
      setActiveSession(activeSessionData || null);
      
      // Set selected session (prefer active, fallback to first)
      if (activeSessionData) {
        console.log('📌 Setting selected session to active:', activeSessionData.name);
        setSelectedSession(activeSessionData);
      } else if (sessionsData.length > 0) {
        console.log('📌 Setting selected session to first:', sessionsData[0].name);
        setSelectedSession(sessionsData[0]);
      }
    } catch (error) {
      console.error('❌ Error loading sessions:', error);
    } finally {
      // Don't set isLoading false here - wait for terms to load
    }
  };

  const loadTerms = async (sessionId: string) => {
    try {
      console.log('📖 Loading terms for session ID:', sessionId);
      const termsData = await termService.getAll(sessionId);
      console.log('📋 Terms loaded:', termsData.length);
      setTerms(termsData);
      
      // Find active term
      const activeTermData = termsData.find(t => t.isActive);
      setActiveTerm(activeTermData || null);
      
      // Set selected term
      if (activeTermData) {
        console.log('📌 Setting selected term to active:', activeTermData.name);
        setSelectedTerm(activeTermData);
      } else if (termsData.length > 0) {
        console.log('📌 Setting selected term to first:', termsData[0].name);
        setSelectedTerm(termsData[0]);
      } else {
        setSelectedTerm(null);
      }
    } catch (error) {
      console.error('❌ Error loading terms:', error);
      setTerms([]);
      setSelectedTerm(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSessions = async () => {
    await loadSessions();
  };

  const refreshTerms = async () => {
    if (selectedSession?.id) {
      await loadTerms(selectedSession.id);
    }
  };

  return (
    <TermContext.Provider value={{
      selectedTerm,
      setSelectedTerm,
      selectedSession,
      setSelectedSession,
      terms,
      sessions,
      activeTerm,
      activeSession,
      isLoading,
      refreshTerms,
      refreshSessions
    }}>
      {children}
    </TermContext.Provider>
  );
};

export const useTerm = () => {
  const context = useContext(TermContext);
  if (context === undefined) {
    throw new Error('useTerm must be used within a TermProvider');
  }
  return context;
};