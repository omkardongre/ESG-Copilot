'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import Modal from '@/components/Modal';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: any[];
}

interface Company {
  company_id: string;
  name: string;
}

export default function ChatPage() {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [errorModal, setErrorModal] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load suggested questions and companies
    loadSuggestions();
    fetchCompanies();
  }, []);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSuggestions = async () => {
    try {
      // For demo, use hardcoded suggestions
      setSuggestions([
        'What ESG regulations apply to my company?',
        'How do I calculate our carbon footprint?',
        'What are the GRI reporting requirements?',
        'How can we improve our ESG score?',
        'What is the deadline for CSRD compliance?',
      ]);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const fetchCompanies = async () => {
    try {
      // Get access token
      const tokenResponse = await fetch('/api/auth/token');
      const { accessToken } = await tokenResponse.json();

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/companies`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch companies');
      
      const data = await response.json();
      setCompanies(data.companies || []);
      
      // Auto-select first company if available
      if (data.companies && data.companies.length > 0) {
        setSelectedCompany(data.companies[0].company_id);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input;
    if (!text.trim()) return;

    if (!selectedCompany) {
      setErrorModal({ show: true, message: 'Please select a company first' });
      return;
    }

    setLoading(true);
    setInput('');

    // Add user message
    const userMessage: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);

    try {
      // Get access token
      const tokenResponse = await fetch('/api/auth/token');
      const { accessToken } = await tokenResponse.json();

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ 
          message: text,
          companyId: selectedCompany, // Use selected company
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to get response');
      }

      const data = await response.json();

      // Add assistant message
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message || data.response,
        sources: data.sources,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}. Please make sure:\n1. Backend API is running\n2. Pinecone API key is added to Auth0 Token Vault\n3. You have generated reports to populate the knowledge base`,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">ESG Copilot Assistant</h1>
        <p className="text-gray-600 mt-2">
          Ask questions about ESG compliance, regulations, and sustainability reporting
        </p>
      </div>

      {/* Company Selector */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Company Context
        </label>
        <select 
          value={selectedCompany}
          onChange={(e) => setSelectedCompany(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        >
          <option value="">Select a company...</option>
          {companies.map(company => (
            <option key={company.company_id} value={company.company_id}>
              {company.name}
            </option>
          ))}
        </select>
        {selectedCompany && (
          <p className="text-xs text-gray-500 mt-2">
            💬 Chat will use data from: <strong>{companies.find(c => c.company_id === selectedCompany)?.name}</strong>
          </p>
        )}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 bg-white rounded-lg shadow overflow-y-auto p-6 mb-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🤖</div>
            <h3 className="text-xl font-semibold mb-2">Welcome to ESG Copilot!</h3>
            <p className="text-gray-600 mb-6">
              I can help you with ESG compliance, regulations, and reporting.
            </p>
            
            {/* Suggested Questions */}
            <div className="max-w-2xl mx-auto">
              <p className="text-sm font-medium text-gray-700 mb-3">Try asking:</p>
              <div className="space-y-2">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => sendMessage(suggestion)}
                    className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-left text-sm transition"
                  >
                    💬 {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3xl px-4 py-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    <span className="text-xl">
                      {message.role === 'user' ? '👤' : '🤖'}
                    </span>
                    <div className="flex-1">
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-300">
                          <p className="text-xs font-semibold mb-2">Sources ({message.sources.length} documents):</p>
                          {message.sources.map((source, i) => (
                            <p key={i} className="text-xs opacity-75">
                              📄 {source.metadata?.section || 'Document'} - Score: {source.score?.toFixed(3) || 'N/A'}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-3xl px-4 py-3 rounded-lg bg-gray-100">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">🤖</span>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex space-x-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about ESG compliance..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            rows={2}
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold transition"
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>

      {/* Error Modal */}
      <Modal
        isOpen={errorModal.show}
        onClose={() => setErrorModal({ show: false, message: '' })}
        title="Error"
        type="error"
      >
        <p className="text-gray-700">{errorModal.message}</p>
      </Modal>
    </div>
  );
}
