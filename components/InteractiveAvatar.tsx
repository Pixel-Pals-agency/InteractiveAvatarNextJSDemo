import type { StartAvatarResponse } from "@heygen/streaming-avatar";

import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
  TaskMode,
  TaskType,
  VoiceEmotion,
} from "@heygen/streaming-avatar";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Divider,
  Input,
  Select,
  SelectItem,
  Spinner,
  Chip,
  Tabs,
  Tab,
} from "@nextui-org/react";
import { useEffect, useRef, useState } from "react";

import InteractiveAvatarTextInput from "./InteractiveAvatarTextInput";

import { AVATARS, STT_LANGUAGE_LIST } from "@/app/lib/constants";

const WEBHOOK_URL = "https://n8n.fastynet.click/webhook/b68e20df-39d6-4baa-a862-5b5f6b9bbcc6/chat";

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
  error?: any;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export default function InteractiveAvatar() {
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [stream, setStream] = useState<MediaStream>();
  const [data, setData] = useState<StartAvatarResponse>();
  const [text, setText] = useState<string>("");
  const [chatMode, setChatMode] = useState("voice_mode");
  const [isRecording, setIsRecording] = useState(false);
  const [isAvatarTalking, setIsAvatarTalking] = useState(false);
  const [lastRecognizedSpeech, setLastRecognizedSpeech] = useState<string>("");
  const [avatarResponse, setAvatarResponse] = useState<string>("");
  const [selectedAvatar, setSelectedAvatar] = useState("default");
  const [selectedLanguage, setSelectedLanguage] = useState("en");

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const avatar = useRef<StreamingAvatar | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionIdRef = useRef<string>("");

  // Set up video stream when available
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initializeSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error("Speech recognition is not supported in this browser");
      return;
    }

    const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionConstructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = selectedLanguage;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (isAvatarTalking) return;

      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        setLastRecognizedSpeech(finalTranscript);
        sendToWebhook(finalTranscript);
        recognition.stop();
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      if (chatMode === "voice_mode" && !isAvatarTalking) recognition.start();
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
    };

    recognitionRef.current = recognition;
  };

  const startRecording = () => {
    if (!recognitionRef.current) initializeSpeechRecognition();
    if (chatMode === "voice_mode") recognitionRef.current?.start();
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const startSession = async () => {
    setIsLoadingSession(true);
    const token = await fetch("/api/get-access-token", { method: "POST" }).then((res) => res.text());
    avatar.current = new StreamingAvatar({ token, basePath: process.env.NEXT_PUBLIC_BASE_API_URL });

    avatar.current.on(StreamingEvents.AVATAR_START_TALKING, () => {
      stopRecording();
      setIsAvatarTalking(true);
    });

    avatar.current.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
      setIsAvatarTalking(false);
      if (chatMode === "voice_mode") startRecording();
    });

    avatar.current.on(StreamingEvents.STREAM_READY, (event) => {
      setStream(event.detail);
    });

    const res = await avatar.current.createStartAvatar({
      quality: AvatarQuality.Low,
      avatarName: selectedAvatar,
      language: selectedLanguage,
      voice: { emotion: VoiceEmotion.EXCITED, rate: 1.5 },
      disableIdleTimeout: true,
    });

    setData(res);
    sessionIdRef.current = res.sessionId || `session-${Date.now()}`;
    await sendToWebhook("start");
    if (chatMode === "voice_mode") startRecording();
    setIsLoadingSession(false);
  };

  const sendToWebhook = async (message: string) => {
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionIdRef.current, message }),
      });
      
      const responseData = await response.json();
      if (responseData.response) {
        setAvatarResponse(responseData.response);
        if (avatar.current) {
          await avatar.current.createTalk({
            text: responseData.response,
            taskType: TaskType.TALK,
            taskMode: TaskMode.STANDARD,
          });
        }
      }
    } catch (error) {
      console.error("Error sending to webhook:", error);
    }
  };

  const handleSpeak = async () => {
    if (avatar.current && text.trim()) {
      await sendToWebhook(text);
      setText("");
    }
  };

  const endSession = async () => {
    stopRecording();
    await avatar.current?.stopAvatar();
    setStream(undefined);
    sessionIdRef.current = "";
    setAvatarResponse("");
    setLastRecognizedSpeech("");
  };

  const handleChatModeChange = (mode: string) => {
    setChatMode(mode);
    if (mode === "voice_mode") {
      startRecording();
    } else {
      stopRecording();
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardBody className="flex flex-col gap-4">
        {/* Avatar display area */}
        {stream ? (
          <div className="w-full aspect-video bg-gray-100 rounded-lg overflow-hidden">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-full aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">Avatar will appear here</p>
          </div>
        )}

        {/* Avatar settings */}
        {!stream && (
          <div className="grid grid-cols-2 gap-4">
            <Select 
              label="Avatar" 
              value={selectedAvatar}
              onChange={(e) => setSelectedAvatar(e.target.value)}
            >
              {AVATARS.map((avatar) => (
                <SelectItem key={avatar.value} value={avatar.value}>
                  {avatar.label}
                </SelectItem>
              ))}
            </Select>
            
            <Select 
              label="Language" 
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
            >
              {STT_LANGUAGE_LIST.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </Select>
          </div>
        )}
        
        {/* Interaction mode tabs */}
        {stream && (
          <>
            <Tabs 
              selectedKey={chatMode} 
              onSelectionChange={handleChatModeChange as any}
              aria-label="Chat Mode"
            >
              <Tab key="voice_mode" title="Voice Chat">
                <div className="py-2">
                  {isRecording ? (
                    <Chip color="danger" variant="dot">Recording...</Chip>
                  ) : (
                    <Chip color="default">Not recording</Chip>
                  )}
                  
                  {lastRecognizedSpeech && (
                    <div className="mt-2 p-2 bg-gray-100 rounded-lg">
                      <p className="text-sm"><strong>You said:</strong> {lastRecognizedSpeech}</p>
                    </div>
                  )}
                </div>
              </Tab>
              <Tab key="text_mode" title="Text Chat">
                <div className="py-2 flex gap-2">
                  <Input 
                    value={text} 
                    onChange={(e) => setText(e.target.value)} 
                    placeholder="Type your message here..."
                    onKeyPress={(e) => e.key === 'Enter' && handleSpeak()}
                    fullWidth
                  />
                  <Button onClick={handleSpeak} disabled={isAvatarTalking || !text.trim()}>
                    Send
                  </Button>
                </div>
              </Tab>
            </Tabs>

            {/* Avatar response */}
            {avatarResponse && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm"><strong>Avatar:</strong> {avatarResponse}</p>
              </div>
            )}
            
            {/* Avatar status */}
            {isAvatarTalking && (
              <div className="flex items-center gap-2">
                <Spinner size="sm" />
                <span>Avatar is speaking...</span>
              </div>
            )}
          </>
        )}
      </CardBody>
      
      <Divider />
      
      <CardFooter className="flex justify-between">
        {!stream ? (
          <Button 
            onClick={startSession} 
            color="primary" 
            disabled={isLoadingSession}
            className="w-full"
          >
            {isLoadingSession ? <Spinner size="sm" /> : "Start Session"}
          </Button>
        ) : (
          <Button 
            onClick={endSession} 
            color="danger"
            className="w-full"
          >
            End Session
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}