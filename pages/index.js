import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';
import config from '../templates/bot-config';
const STORAGE_KEY = 'chat_history'; 

export default function Home() {
  const [messages, setMessages] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const chatContainerRef = useRef(null);
  const saveToStorage = (messages) => {
  const data = JSON.stringify(messages);
  if (data.length > 6000000) { // 限制约4.5MB
    const trimmed = messages.slice(-25); // 保留最近20条
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    return;
  }
  localStorage.setItem(STORAGE_KEY, data);
};

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch (error) {
        console.error('Error de cargacion para memoria local:', error);
      }
    }
  }, [messages]);
  // 初始化对话线程
  useEffect(() => {
    const initializeThread = async () => {
      try {
        const response = await fetch('/api/init-thread');
        const data = await response.json();
        setThreadId(data.threadId);
        
        // 只有初次加载且没有历史记录时才显示欢迎消息
        if (messages.length === 0) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: config.welcomeMessage || '¡Hola! Soy tu asistente. ¿En qué puedo ayudarte hoy?'
          }]);
        }
      } catch (error) {
        console.error('Error initializing thread:', error);
        setMessages([{
          role: 'assistant',
          content: config.errorMessage || 'Disculpa, estoy teniendo problemas. ¿Podrías intentarlo de nuevo?'
        }]);
      }
    };
    
    initializeThread();
  }, []); // 确保空依赖数组


  // 滚动到最新消息
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const lastMessageRef = useRef(null);
  useEffect(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: input,
          threadId: threadId 
        }),
      });

      const data = await response.json();
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: config.errorMessage || 'Disculpa, estoy teniendo dificultades. ¿Podrías intentarlo de nuevo?'
      }]);
    } finally {
      setIsLoading(false);
    }

    useEffect(() => {
    const handleBeforeUnload = () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [messages]);
    
  };

  return (
    <div 
      className={styles.container}
      style={{
        '--color-primary': config.cssConfig.primaryColor,
        '--color-secondary': config.cssConfig.secondaryColor,
        '--message-radius': config.cssConfig.messageRadius,
        '--input-radius': config.cssConfig.inputRadius,
        '--chat-width': config.cssConfig.chatWidth,
        '--chat-height': config.cssConfig.chatHeight,
        '--font-family': config.cssConfig.fontFamily,
        '--font-size': config.cssConfig.fontSize,
        maxWidth: config.cssConfig.chatWidth,
        fontFamily: config.cssConfig.fontFamily,
        fontSize: config.cssConfig.fontSize
      }}
    >
      <Head>
        <title>{config.pageTitle || 'Chatbot'}</title>
        <meta name="description" content={config.subHeading || ''} />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header 
        className={styles.header}
        style={{
          background: `linear-gradient(to right, ${config.cssConfig.secondaryColor}, ${config.cssConfig.primaryColor})`
        }}
      >
        <h1>{config.mainHeading || 'Chatbot'}</h1>
        {config.subHeading && <p>{config.subHeading}</p>}
      </header>

      <div className={styles.chatLayout}>
        <div 
          ref={chatContainerRef}
          className={styles.chatContainer}
        >
          {messages.map((msg, index) => (
            <div 
              key={index} 
              ref={index === messages.length - 1 ? lastMessageRef : null}
              className={`${styles.message} ${
                msg.role === 'user' ? styles.userMessage : styles.assistantMessage
              } ${index === 0 ? styles.firstMessage : ''}`}
            >
              {msg.content}
            </div>
          ))}
          {isLoading && config.cssConfig.showTypingIndicator && (
            <div className={styles.typingIndicator}>
              <div className={styles.typingDot}></div>
              <div className={styles.typingDot}></div>
              <div className={styles.typingDot}></div>
            </div>
          )}
        </div>

        <div className={styles.inputArea}>
          <form onSubmit={handleSubmit} className={styles.inputForm}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={config.inputPlaceholder || 'Escribe tu mensaje aquí...'}
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading}>
              {config.submitButtonText || 'Enviar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}