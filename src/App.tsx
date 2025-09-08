import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef, useState } from 'react';
import OpenAI from 'openai';
import { Paperclip, Camera, Loader2, Mic } from 'lucide-react';
import { Configuration, NewSessionData, StreamingAvatarApi } from '@heygen/streaming-avatar';
import { getAccessToken } from './services/api';
import { Video } from './components/reusable/Video';
import ChatMessage from './components/reusable/ChatMessage';
import ScrollableFeed from 'react-scrollable-feed';
import { Toaster } from "@/components/ui/toaster"

interface ChatMessageType  {
  role: string;
  message: string;
  imageUrl?: string;
  videoUrl?: string;
};

function App() {
  //Toast
  const { toast } = useToast()

  const [isBegin, setIsBegin] = useState<boolean>(false);
  const [startLoading, setStartLoading] = useState<boolean>(true);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [selectedPrompt, setSelectedPrompt] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);
  const [input, setInput] = useState<string>('');
  // Removed MediaRecorder approach in favor of Web Speech API
  const [stream, setStream] = useState<MediaStream>();
  const [data, setData] = useState<NewSessionData>();
  const mediaStream = useRef<HTMLVideoElement>(null);
  const avatar = useRef<StreamingAvatarApi | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessageType[]>([
    // {
    //   role: 'user',
    //   message: 'hi, how are you!'
    // },
    // {
    //   role: 'assistant',
    //   message: 'I am fine, Thank you for asking. How about you!'
    // },
    // {
    //   role: 'user',
    //   message: 'Explain me about python!'
    // },
    // {
    //   role: 'assistant',
    //   message: "Python is an interpreted, object-oriented, high-level programming language with dynamic semantics. Its high-level built in data structures, combined with dynamic typing and dynamic binding, make it very attractive for Rapid Application Development, as well as for use as a scripting or glue language to connect existing components together. Python's simple, easy to learn syntax emphasizes readability and therefore reduces the cost of program maintenance. Python supports modules and packages, which encourages program modularity and code reuse. The Python interpreter and the extensive standard library are available in source or binary form without charge for all major platforms, and can be freely distributed."
    // },
    // {
    //   role: 'user',
    //   message: 'hi, how are you!'
    // },

  ]);

  const [startAvatarLoading, setStartAvatarLoading] = useState<boolean>(false);
  const [stopAvatarLoading, setStopAvatarLoading] = useState<boolean>(false);
  let timeout: any;


  const apiKey: any = import.meta.env.VITE_XAI_API_KEY;
  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.x.ai/v1',
    dangerouslyAllowBrowser: true,
  });


  //Function when user starts speaking (Web Speech API)
  const handleStartSpeaking = () => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        toast({
          variant: "destructive",
          title: "Speech recognition not supported",
          description: "Your browser does not support SpeechRecognition. Try Chrome.",
        });
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = async (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join(' ');
        setChatMessages(prev => [...prev, { role: 'user', message: transcript }]);
        await askGrokWithText(transcript);
      };
      recognition.onerror = (error: any) => {
        console.error('Speech recognition error:', error);
        toast({
          variant: "destructive",
          title: "Speech recognition error",
          description: error.message || 'Unknown error',
        });
        setIsSpeaking(false);
      };
      recognition.onend = () => {
        setIsSpeaking(false);
      };
      recognitionRef.current = recognition;
      recognition.start();
      setIsSpeaking(true);
    } catch (error: any) {
      console.error('Error starting speech recognition:', error);
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: error.message,
      });
    }
  };

  const handleStopSpeaking = async () => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    setIsSpeaking(false);
  };

  // Speak via avatar
  const speakText = async (text: string) => {
    try {
      await avatar.current?.speak({ taskRequest: { text, sessionId: data?.sessionId } });
    } catch (err: any) {
      console.error('Avatar speak error:', err);
    }
  };

  // Ask xAI Grok with plain text
  async function askGrokWithText(text: string) {
    try {
      const aiResponse = await openai.chat.completions.create({
        model: 'grok-2-latest',
        messages: [
          { role: 'user', content: text }
        ]
      });
      const content = aiResponse.choices?.[0]?.message?.content || '';
      setChatMessages(prev => [...prev, { role: 'assistant', message: content }]);
      speakText(content);
      // Remove setInput(content) - AI response should only appear in chat, not input bar
    } catch (error: any) {
      console.error('Error asking Grok:', error);
      toast({
        variant: "destructive",
        title: "xAI request failed",
        description: error.message,
      });
    }
  }

  // Ask xAI Grok with an image data URL (vision)
  async function askGrokWithImage(imageDataUrl: string, prompt: string = 'Please analyze this image and help.') {
    try {
      const aiResponse = await openai.chat.completions.create({
        model: 'grok-2-vision',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } as any }
            ] as any
          }
        ] as any
      } as any);
      const content = aiResponse.choices?.[0]?.message?.content || '';
      setChatMessages(prev => [...prev, { role: 'assistant', message: content }]);
      speakText(content);
      // Remove setInput(content) - AI response should only appear in chat, not input bar
    } catch (error: any) {
      console.error('Error asking Grok (vision):', error);
      toast({
        variant: "destructive",
        title: "xAI vision failed",
        description: error.message,
      });
    }
  }

  // Helpers for file upload and camera capture
  const hiddenFileInput = useRef<HTMLInputElement | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);

  const triggerFilePicker = () => hiddenFileInput.current?.click();

  const fileToDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.type.startsWith('image/')) {
        const dataUrl = await fileToDataUrl(file);
        setChatMessages(prev => [...prev, { role: 'user', message: '', imageUrl: dataUrl }]);
        await askGrokWithImage(dataUrl);
      } else if (file.type.startsWith('video/')) {
        // Extract first frame as image for analysis
        const videoURL = URL.createObjectURL(file);
        const videoEl = document.createElement('video');
        videoEl.src = videoURL;
        await videoEl.play().catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 300));
        const canvas = document.createElement('canvas');
        canvas.width = videoEl.videoWidth || 640;
        canvas.height = videoEl.videoHeight || 360;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          const frameData = canvas.toDataURL('image/png');
          setChatMessages(prev => [...prev, { role: 'user', message: '', videoUrl: videoURL }]);
          await askGrokWithImage(frameData, 'This frame is from a user-provided video. Provide helpful insights.');
        }
        // Do not revoke object URL immediately to allow playback in chat
      } else {
        toast({
          variant: "destructive",
          title: "Unsupported file",
          description: "Please upload an image or video.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message,
      });
    } finally {
      if (hiddenFileInput.current) hiddenFileInput.current.value = '';
    }
  };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setIsCameraOpen(true);
      setCameraStream(stream);
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        cameraVideoRef.current.onloadedmetadata = () => {
          cameraVideoRef.current?.play();
        };
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Camera access denied",
        description: error.message,
      });
    }
  };

  const closeCamera = () => {
    cameraStream?.getTracks().forEach(t => t.stop());
    setCameraStream(null);
    setIsCameraOpen(false);
  };

  const captureFromCamera = async () => {
    if (!cameraVideoRef.current) return;
    const videoEl = cameraVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth || 640;
    canvas.height = videoEl.videoHeight || 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    setChatMessages(prev => [...prev, { role: 'user', message: '', imageUrl: dataUrl }]);
    await askGrokWithImage(dataUrl, 'User captured this photo. Provide solutions in natural conversation.');
    closeCamera();
  };



  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (avatar.current) {
        avatar.current.removeEventHandler("avatar_stop_talking", handleAvatarStopTalking);
      }
      clearTimeout(timeout);
    }
  }, []);

// Avatar stop talking event handler
const handleAvatarStopTalking = (e: any) => {
  console.log("Avatar stopped talking", e);
  timeout = setTimeout(() => {
    handleStartSpeaking();
  }, 2000);
};


// Function to initiate the avatar
async function grab() {
  setStartLoading(true);
  setStartAvatarLoading(true);
  try {
    const response = await getAccessToken();
    const token = response.data.data.token;

    // Always instantiate a fresh API client with the latest token to avoid 401 from expired tokens
    if (avatar.current) {
      avatar.current.removeEventHandler("avatar_stop_talking", handleAvatarStopTalking);
    }
    avatar.current = new StreamingAvatarApi(
      new Configuration({ accessToken: token })
    );
    avatar.current.addEventHandler("avatar_stop_talking", handleAvatarStopTalking);

    const res = await avatar.current!.createStartAvatar(
      {
        newSessionRequest: {
          quality: "low",
          avatarName: import.meta.env.VITE_HEYGEN_AVATARID,
          voice: { voiceId: import.meta.env.VITE_HEYGEN_VOICEID }
        }
      },
    );
    console.log(res);
    setData(res);
    setStream(avatar.current!.mediaStream);
    setStartLoading(false);
    setStartAvatarLoading(false);
    setIsBegin(true);

  } catch (error: any) {
    console.log(error.message);
    setStartAvatarLoading(false);
    setStartLoading(false);
    toast({
      variant: "destructive",
      title: "Uh oh! Something went wrong.",
      description: error.response.data.message || error.message,
    })
  }
};

// Auto-initialize on component mount
useEffect(() => {
  const initializeApp = async () => {
    setIsInitializing(true);
    await grab();
    setIsInitializing(false);
  };
  
  initializeApp();
}, []);

//Function to stop the avatar
async function stop() {
  setStopAvatarLoading(true);
  try {
    await avatar.current?.stopAvatar({ stopSessionRequest: { sessionId: data?.sessionId } });
    // handleStopSpeaking();
    setStopAvatarLoading(false);
    avatar.current = null;
  } catch (error: any) {
    setStopAvatarLoading(false);
    toast({
      variant: "destructive",
      title: "Uh oh! Something went wrong.",
      description: error.response.data.message || error.message,
    })
  }
}


// When the user selects the pre-defined prompts, this useEffect will get triggered
useEffect(() => {
  if (selectedPrompt) {
    setChatMessages(prev => [...prev, { role: 'user', message: selectedPrompt }]);
    askGrokWithText(selectedPrompt);
  }
}, [selectedPrompt])


// When the stream gets the data, The avatar video will gets played
useEffect(() => {
  if (stream && mediaStream.current) {
    console.log(stream);
    console.log(mediaStream.current);
    mediaStream.current.srcObject = stream;
    mediaStream.current.onloadedmetadata = () => {
      mediaStream.current!.play();
    };
  }
}, [stream]);

return (
  <>
    <Toaster />
    <div className="fixed top-0 left-0 right-0 z-20 w-full bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 text-white text-center py-3 tracking-wide font-semibold shadow-lg">
      iSolveUrProblems – beta
    </div>
    {/* {
      isInitializing ? (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white text-xl font-semibold">Initializing Avatar...</p>
            <p className="text-blue-200 text-sm mt-2">Setting up your AI assistant</p>
          </div>
        </div>
      ) : (
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col lg:h-full">
          <div className="flex flex-col h-screen lg:hidden">
            <div className="fixed top-16 left-0 right-0 h-[calc(50vh-2rem)] z-10 px-4">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl h-full flex flex-col">
                <div className="p-2 border-b border-white/20 flex-shrink-0">
                  <h3 className="text-white font-semibold text-lg">🤖 AI Avatar</h3>
                </div>
                <div className="flex-1 p-2 flex items-center justify-center min-h-0">
                  <div className="w-full h-full max-w-sm mx-auto">
                    <Video ref={mediaStream} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 pt-[calc(50vh-2rem)] px-4 pb-48 overflow-y-auto">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl h-full flex flex-col">
                <div className="p-4 border-b border-white/20 flex-shrink-0">
                  <h3 className="text-white font-semibold text-lg">💬 Chat</h3>
                </div>

                <div className="flex-1 overflow-hidden min-h-0">
                  {
                    chatMessages.length > 0 ? (
                      <ScrollableFeed className="h-full">
                        <div className="p-4 overflow-y-auto pb-[calc(12rem+env(safe-area-inset-bottom))]">
                          {
                            chatMessages.map((chatMsg, index) => (
                              <ChatMessage
                                key={index}
                                role={chatMsg.role}
                                message={chatMsg.message}
                                imageUrl={chatMsg.imageUrl}
                                videoUrl={chatMsg.videoUrl}
                              />
                            ))
                          }
                        </div>
                      </ScrollableFeed>
                    ) : (
                      <div className="h-full flex justify-center items-center">
                        <div className="text-center text-white/70">
                          <div className="text-6xl mb-6">💬</div>
                          <p className="text-xl font-medium mb-2">Start a conversation</p>
                          <p className="text-sm opacity-80">Type a message or use the controls below</p>
                        </div>
                      </div>
                    )
                  }
                </div>
              </div>
            </div>
            <div className="fixed bottom-0 left-0 right-0 z-20 px-4 pb-[env(safe-area-inset-bottom)]">
              <div className="space-y-2">
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-2">
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={stop}
                      disabled={stopAvatarLoading}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white text-sm font-semibold shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50"
                    >
                      {stopAvatarLoading && <Loader2 className="mr-1 h-3 w-3 animate-spin inline" />}
                      Stop
                    </button>
                    <button
                      onClick={grab}
                      disabled={startAvatarLoading}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white text-sm font-semibold shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50"
                    >
                      {startAvatarLoading && <Loader2 className="mr-1 h-3 w-3 animate-spin inline" />}
                      Start
                    </button>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={triggerFilePicker}
                      className='p-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg transition-all duration-200 hover:scale-105'
                    >
                      <Paperclip className='w-4 h-4' />
                    </button>
                    <button
                      onClick={openCamera}
                      className='p-2 rounded-full bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white shadow-lg transition-all duration-200 hover:scale-105'
                    >
                      <Camera className='w-4 h-4' />
                    </button>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Type your message..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && input.trim()) {
                            setChatMessages(prev => [...prev, { role: 'user', message: input }]);
                            askGrokWithText(input);
                            setInput('');
                          }
                        }}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      onClick={() => {
                        if (input.trim()) {
                          setChatMessages(prev => [...prev, { role: 'user', message: input }]);
                          askGrokWithText(input);
                          setInput('');
                        }
                      }}
                      disabled={!input.trim()}
                      className="p-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                    <button
                      onClick={isSpeaking ? handleStopSpeaking : handleStartSpeaking}
                      className={`p-2 rounded-full text-white shadow-lg transition-all duration-200 hover:scale-105 ${isSpeaking
                          ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 animate-pulse'
                          : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'
                        }`}
                    >
                      <Mic size={16} />
                    </button>
                  </div>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    ref={hiddenFileInput}
                    onChange={handleFileChange}
                    className='hidden'
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex flex-1 pt-16 px-4 pb-28 min-h-0">
            <div className="h-full max-w-7xl mx-auto w-full min-h-0">
              <div className="grid grid-cols-2 gap-6 h-full min-h-0">
                <div className="flex flex-col h-full min-h-0">
                  <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl h-full flex flex-col min-h-0">
                    <div className="p-4 border-b border-white/20">
                      <h3 className="text-white font-semibold text-lg">💬 Chat</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                      {
                        chatMessages.length > 0 ? (
                          <ScrollableFeed className="h-full">
                            <div className="p-4 h-full overflow-y-auto">
                              {
                                chatMessages.map((chatMsg, index) => (
                                  <ChatMessage
                                    key={index}
                                    role={chatMsg.role}
                                    message={chatMsg.message}
                                    imageUrl={chatMsg.imageUrl}
                                    videoUrl={chatMsg.videoUrl}
                                  />
                                ))
                              }
                            </div>
                          </ScrollableFeed>
                        ) : (
                          <div className="h-full flex justify-center items-center">
                            <div className="text-center text-white/70">
                              <div className="text-6xl mb-6">💬</div>
                              <p className="text-xl font-medium mb-2">Start a conversation</p>
                              <p className="text-sm opacity-80">Type a message or use the controls below</p>
                            </div>
                          </div>
                        )
                      }
                    </div>
                  </div>
                </div>

                <div className="flex flex-col h-full min-h-0">
                  <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl h-full flex flex-col">
                    <div className="p-4 border-b border-white/20">
                      <h3 className="text-white font-semibold text-lg">🤖 AI Avatar</h3>
                    </div>
                    <div className="flex-1 p-4 flex items-center justify-center min-h-0">
                      <div className="w-full h-full max-w-md mx-auto">
                        <Video ref={mediaStream} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden lg:block fixed bottom-0 left-0 right-0 z-20 px-4 pb-[env(safe-area-inset-bottom)]">
            <div className="max-w-7xl mx-auto w-full">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-3 flex items-center gap-3">
                <button
                  onClick={triggerFilePicker}
                  className='p-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg transition-all duration-200 hover:scale-105'
                >
                  <Paperclip className='w-4 h-4' />
                </button>
                <button
                  onClick={openCamera}
                  className='p-2 rounded-full bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white shadow-lg transition-all duration-200 hover:scale-105'
                >
                  <Camera className='w-4 h-4' />
                </button>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Type your message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && input.trim()) {
                        setChatMessages(prev => [...prev, { role: 'user', message: input }]);
                        askGrokWithText(input);
                        setInput('');
                      }
                    }}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={() => {
                    if (input.trim()) {
                      setChatMessages(prev => [...prev, { role: 'user', message: input }]);
                      askGrokWithText(input);
                      setInput('');
                    }
                  }}
                  disabled={!input.trim()}
                  className="p-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
                <button
                  onClick={isSpeaking ? handleStopSpeaking : handleStartSpeaking}
                  className={`p-2 rounded-full text-white shadow-lg transition-all duration-200 hover:scale-105 ${isSpeaking
                      ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 animate-pulse'
                      : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'
                    }`}
                >
                  <Mic size={16} />
                </button>

                <div className="flex gap-2 pl-2">
                  <button
                    onClick={stop}
                    disabled={stopAvatarLoading}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white text-sm font-semibold shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50"
                  >
                    {stopAvatarLoading && <Loader2 className="mr-1 h-3 w-3 animate-spin inline" />}
                    Stop Avatar
                  </button>
                  <button
                    onClick={grab}
                    disabled={startAvatarLoading}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white text-sm font-semibold shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50"
                  >
                    {startAvatarLoading && <Loader2 className="mr-1 h-3 w-3 animate-spin inline" />}
                    Start Avatar
                  </button>
                </div>

                <input
                  type="file"
                  accept="image/*,video/*"
                  ref={hiddenFileInput}
                  onChange={handleFileChange}
                  className='hidden'
                />
              </div>
            </div>
          </div>


          {isCameraOpen && (
            <div className='fixed inset-0 bg-black/80 backdrop-blur-sm z-30 flex items-center justify-center p-4'>
              <div className='bg-white/10 backdrop-blur-lg rounded-2xl p-6 w-full max-w-sm flex flex-col items-center gap-4 border border-white/20 shadow-2xl'>
                <video ref={cameraVideoRef} className='w-full rounded-xl' playsInline autoPlay />
                <div className='flex gap-3'>
                  <button onClick={captureFromCamera} className='px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white font-semibold shadow-lg transition-all duration-200 hover:scale-105'>
                    Capture
                  </button>
                  <button onClick={closeCamera} className='px-6 py-3 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold border border-white/30 transition-all duration-200'>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )
    } */}
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col lg:h-full">
          {/* Mobile Layout */}
          <div className="flex flex-col h-screen lg:hidden">
            {/* Fixed Avatar Section - Takes exactly half screen height */}
            <div className="fixed top-16 left-0 right-0 h-[calc(50vh-2rem)] z-10 px-4">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl h-full flex flex-col">
                <div className="p-2 border-b border-white/20 flex-shrink-0">
                  <h3 className="text-white font-semibold text-lg">🤖 AI Avatar</h3>
                </div>
                <div className="flex-1 p-2 flex items-center justify-center min-h-0">
                  <div className="w-full h-full max-w-sm mx-auto">
                    <Video ref={mediaStream} />
                  </div>
                </div>
                {/* Controls moved to fixed bottom bar on mobile */}
              </div>
            </div>

            {/* Scrollable Chat Section - Positioned below avatar */}
            <div className="flex-1 pt-[calc(50vh-2rem)] px-4 pb-48 overflow-y-auto">
              <div className="rounded-2xl h-full flex flex-col">
                <div className="p-4 border-b border-white/20 flex-shrink-0">
                  <h3 className="text-white font-semibold text-lg">💬 Chat</h3>
                </div>

                {chatMessages.length > 0 ? (
                      <ScrollableFeed className="h-full">
                        <div className="p-4 overflow-y-auto pb-[calc(12rem+env(safe-area-inset-bottom))]">
                          {
                            chatMessages.map((chatMsg, index) => (
                              <ChatMessage
                                key={index}
                                role={chatMsg.role}
                                message={chatMsg.message}
                                imageUrl={chatMsg.imageUrl}
                                videoUrl={chatMsg.videoUrl}
                              />
                            ))
                          }
                        </div>
                      </ScrollableFeed>
                    ) : (
                      <div className="h-full flex justify-center items-center">
                        <div className="text-center text-white/70">
                          <div className="text-6xl mb-6">💬</div>
                          <p className="text-xl font-medium mb-2">Start a conversation</p>
                          <p className="text-sm">Type a message or use the controls below</p>
                        </div>
                      </div>
                    )
                  }
                {/* Chat Messages Area */}
                {/* <div className="flex-1 min-h-0">
                  {
                    
                  }
                </div> */}

                {/* Chat Input moved to fixed bottom bar on mobile */}
              </div>
            </div>
            {/* Fixed Bottom Controls (Mobile) */}
            <div className="fixed bottom-0 left-0 right-0 z-20 px-4 pb-[env(safe-area-inset-bottom)]">
              <div className="space-y-2">
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-2">
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={stop}
                      disabled={stopAvatarLoading}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white text-sm font-semibold shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50"
                    >
                      {stopAvatarLoading && <Loader2 className="mr-1 h-3 w-3 animate-spin inline" />}
                      Stop
                    </button>
                    <button
                      onClick={grab}
                      disabled={startAvatarLoading}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white text-sm font-semibold shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50"
                    >
                      {startAvatarLoading && <Loader2 className="mr-1 h-3 w-3 animate-spin inline" />}
                      Start
                    </button>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={triggerFilePicker}
                      className='p-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg transition-all duration-200 hover:scale-105'
                    >
                      <Paperclip className='w-4 h-4' />
                    </button>
                    <button
                      onClick={openCamera}
                      className='p-2 rounded-full bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white shadow-lg transition-all duration-200 hover:scale-105'
                    >
                      <Camera className='w-4 h-4' />
                    </button>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Type your message..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && input.trim()) {
                            setChatMessages(prev => [...prev, { role: 'user', message: input }]);
                            askGrokWithText(input);
                            setInput('');
                          }
                        }}
                        className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      onClick={() => {
                        if (input.trim()) {
                          setChatMessages(prev => [...prev, { role: 'user', message: input }]);
                          askGrokWithText(input);
                          setInput('');
                        }
                      }}
                      disabled={!input.trim()}
                      className="p-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                    <button
                      onClick={isSpeaking ? handleStopSpeaking : handleStartSpeaking}
                      className={`p-2 rounded-full text-white shadow-lg transition-all duration-200 hover:scale-105 ${isSpeaking
                          ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 animate-pulse'
                          : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'
                        }`}
                    >
                      <Mic size={16} />
                    </button>
                  </div>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    ref={hiddenFileInput}
                    onChange={handleFileChange}
                    className='hidden'
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden lg:flex flex-1 pt-16 px-4 pb-28 min-h-0">
            <div className="h-full max-w-7xl mx-auto w-full min-h-0">
              <div className="grid grid-cols-2 gap-6 h-full min-h-0">
                {/* Chat Section */}
                <div className="flex flex-col h-full min-h-0">
                  <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl h-full flex flex-col min-h-0">
                    <div className="p-4 border-b border-white/20">
                      <h3 className="text-white font-semibold text-lg">💬 Chat</h3>
                    </div>

                    {/* Chat Messages Area */}
                    <div className="flex-1 overflow-y-auto">
                      {
                        chatMessages.length > 0 ? (
                          <ScrollableFeed className="h-full">
                            <div className="p-4 h-full overflow-y-auto">
                              {
                                chatMessages.map((chatMsg, index) => (
                                  <ChatMessage
                                    key={index}
                                    role={chatMsg.role}
                                    message={chatMsg.message}
                                    imageUrl={chatMsg.imageUrl}
                                    videoUrl={chatMsg.videoUrl}
                                  />
                                ))
                              }
                            </div>
                          </ScrollableFeed>
                        ) : (
                          <div className="h-full flex justify-center items-center">
                            <div className="text-center text-white/70">
                              <div className="text-6xl mb-6">💬</div>
                              <p className="text-xl font-medium mb-2">Start a conversation</p>
                              <p className="text-sm opacity-80">Type a message or use the controls below</p>
                            </div>
                          </div>
                        )
                      }
                    </div>

                    {/* Chat Input moved to fixed bottom bar on desktop */}
                  </div>
                </div>

                {/* Avatar Section */}
                <div className="flex flex-col h-full min-h-0">
                  <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl h-full flex flex-col">
                    <div className="p-4 border-b border-white/20">
                      <h3 className="text-white font-semibold text-lg">🤖 AI Avatar</h3>
                    </div>
                    <div className="flex-1 p-4 flex items-center justify-center min-h-0">
                      <div className="w-full h-full max-w-md mx-auto">
                        <Video ref={mediaStream} />
                      </div>
                    </div>

                    {/* Avatar controls moved to fixed bottom bar on desktop */}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Bottom Controls (Desktop) */}
          <div className="hidden lg:block fixed bottom-0 left-0 right-0 z-20 px-4 pb-[env(safe-area-inset-bottom)]">
            <div className="max-w-7xl mx-auto w-full">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl p-3 flex items-center gap-3">
                <button
                  onClick={triggerFilePicker}
                  className='p-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg transition-all duration-200 hover:scale-105'
                >
                  <Paperclip className='w-4 h-4' />
                </button>
                <button
                  onClick={openCamera}
                  className='p-2 rounded-full bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white shadow-lg transition-all duration-200 hover:scale-105'
                >
                  <Camera className='w-4 h-4' />
                </button>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Type your message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && input.trim()) {
                        setChatMessages(prev => [...prev, { role: 'user', message: input }]);
                        askGrokWithText(input);
                        setInput('');
                      }
                    }}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={() => {
                    if (input.trim()) {
                      setChatMessages(prev => [...prev, { role: 'user', message: input }]);
                      askGrokWithText(input);
                      setInput('');
                    }
                  }}
                  disabled={!input.trim()}
                  className="p-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
                <button
                  onClick={isSpeaking ? handleStopSpeaking : handleStartSpeaking}
                  className={`p-2 rounded-full text-white shadow-lg transition-all duration-200 hover:scale-105 ${isSpeaking
                      ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 animate-pulse'
                      : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'
                    }`}
                >
                  <Mic size={16} />
                </button>

                <div className="flex gap-2 pl-2">
                  <button
                    onClick={stop}
                    disabled={stopAvatarLoading}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white text-sm font-semibold shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50"
                  >
                    {stopAvatarLoading && <Loader2 className="mr-1 h-3 w-3 animate-spin inline" />}
                    Stop Avatar
                  </button>
                  <button
                    onClick={grab}
                    disabled={startAvatarLoading}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white text-sm font-semibold shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50"
                  >
                    {startAvatarLoading && <Loader2 className="mr-1 h-3 w-3 animate-spin inline" />}
                    Start Avatar
                  </button>
                </div>

                <input
                  type="file"
                  accept="image/*,video/*"
                  ref={hiddenFileInput}
                  onChange={handleFileChange}
                  className='hidden'
                />
              </div>
            </div>
          </div>


          {isCameraOpen && (
            <div className='fixed inset-0 bg-black/80 backdrop-blur-sm z-30 flex items-center justify-center p-4'>
              <div className='bg-white/10 backdrop-blur-lg rounded-2xl p-6 w-full max-w-sm flex flex-col items-center gap-4 border border-white/20 shadow-2xl'>
                <video ref={cameraVideoRef} className='w-full rounded-xl' playsInline autoPlay />
                <div className='flex gap-3'>
                  <button onClick={captureFromCamera} className='px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white font-semibold shadow-lg transition-all duration-200 hover:scale-105'>
                    Capture
                  </button>
                  <button onClick={closeCamera} className='px-6 py-3 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold border border-white/30 transition-all duration-200'>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
  </>
);
}

export default App;
