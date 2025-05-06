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
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { usePrevious } from "ahooks";
import { debounce } from "lodash";
import sanitizeHtml from "sanitize-html";

import InteractiveAvatarTextInput from "./InteractiveAvatarTextInput";
import { AVATARS, STT_LANGUAGE_LIST } from "@/app/lib/constants";

// Use environment variable for webhook URL
const WEBHOOK_URL = process.env.NEXT_PUBLIC_WEBHOOK_URL || "https://n8n.fastynet.click/webhook/b68e20df-39d6-4baa-a862-5b5f6b9bbcc6/chat";

// Interfaces for Web Speech API
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

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// Interface for webhook response
interface WebhookResponse {
  response?: string;
  output?: string;
}

export default function InteractiveAvatar() {
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isLoadingRepeat, setIsLoadingRepeat] = useState(false);
  const [stream, setStream] = useState<MediaStream>();
  const [debug, setDebug] = useState<string>("");
  const [knowledgeId, setKnowledgeId] = useState<string>("");
  const [avatarId, setAvatarId] = useState<string>("");
  const [language, setLanguage] = useState<string>("en");
  const [sessionId, setSessionId] = useState<string>("");
  const sessionIdRef = useRef<string>("");
  const [data, setData] = useState<StartAvatarResponse>();
  const [text, setText] = useState<string>("");
  const mediaStream = useRef<HTMLVideoElement>(null);
  const avatar = useRef<StreamingAvatar | null>(null);
  const [chatMode, setChatMode] = useState<"voice_mode" | "text_mode">("voice_mode");
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [processingWebhook, setProcessingWebhook] = useState(false);
  const [speakingError, setSpeakingError] = useState<string>("");
  const [lastRecognizedSpeech, setLastRecognizedSpeech] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [isAvatarTalking, setIsAvatarTalking] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Sync sessionIdRef with sessionId
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Generate session ID
  const generateSessionId = useCallback(() => {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  const baseApiUrl = useCallback(() => {
    return process.env.NEXT_PUBLIC_BASE_API_URL || "";
  }, []);

  // Fetch access token
  const fetchAccessToken = useCallback(async () => {
    try {
      const response = await fetch("/api/get-access-token", { method: "POST" });
      if (!response.ok) {
        throw new Error(`Failed to fetch access token: ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setDebug(`Failed to fetch access token: ${errorMessage}`);
      throw error;
    }
  }, []);

  // Send messages to webhook with retries and sanitization
  const sendToWebhook = useMemo(
    () =>
      debounce(async (message: string) => {
        if (!message.trim() || !sessionIdRef.current) {
          setDebug("Cannot send empty message or missing session ID");
          return;
        }

        const sanitizedMessage = sanitizeHtml(message, { allowedTags: [] });
        setProcessingWebhook(true);
        const maxRetries = 3;
        let attempt = 0;

        while (attempt < maxRetries) {
          try {
            const response = await fetch(WEBHOOK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId: sessionIdRef.current, message: sanitizedMessage }),
            });

            if (!response.ok) {
              throw new Error(`Webhook response error: ${response.status}`);
            }

            const responseData = (await response.json()) as WebhookResponse;
            const textToSpeak = responseData.response || responseData.output;

            if (!textToSpeak) {
              throw new Error("Invalid webhook response: missing response or output field");
            }

            const cleanedText = textToSpeak.replace(/<analysis>[\s\S]*?</analysis>/g, "").trim();
            if (cleanedText && avatar.current) {
              if (isRecording) {
                stopRecording();
              }
              await avatar.current.speak({
                text: cleanedText,
                taskType: TaskType.REPEAT,
                taskMode: TaskMode.SYNC,
              });
            }

            return responseData;
          } catch (error) {
            attempt++;
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (attempt === maxRetries) {
              setDebug(`Webhook failed after ${maxRetries} attempts: ${errorMessage}`);
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          } finally {
            setProcessingWebhook(false);
          }
        }
      }, 500),
    []
  );

  // Initialize speech recognition
  const initializeSpeechRecognition = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setDebug("Speech recognition is not supported in this browser");
      setChatMode("text_mode");
      alert("Your browser doesn't support speech recognition. Switching to text mode.");
      return;
    }

    const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionConstructor();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = language;

    recognition.onstart = () => {
      setIsUserTalking(true);
      setIsRecording(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (isAvatarTalking) return;

      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        setLastRecognizedSpeech(finalTranscript);
        if (finalTranscript.trim()) {
          sendToWebhook(finalTranscript);
          recognition.stop();
        }
      } else {
        setLastRecognizedSpeech(interimTranscript);
      }
    };

    recognition.onend = () => {
      setIsUserTalking(false);
      setIsRecording(false);

      if (chatMode === "voice_mode" && !isAvatarTalking && !isRecording) {
        setTimeout(() => {
          if (chatMode === "voice_mode" && !isAvatarTalking && !isRecording) {
            startRecording();
          }
        }, 2000);
      }
    };

    recognition.onerror = (event: SpeechRecognitionEvent) => {
      const errorMessage = event.error || "Unknown error";
      setDebug(`Speech recognition error: ${errorMessage}`);
      setIsUserTalking(false);
      setIsRecording(false);

      if (["network", "audio-capture"].includes(errorMessage) && chatMode === "voice_mode") {
        setTimeout(() => startRecording(), 2000);
      }
    };

    recognitionRef.current = recognition;
  }, [language, chatMode, isAvatarTalking, sendToWebhook, startRecording]);

  // Start recording
  const startRecording = useCallback(() => {
    if (isAvatarTalking) {
      setDebug("Cannot start recording while avatar is talking");
      return;
    }

    if (!recognitionRef.current) {
      initializeSpeechRecognition();
    }

    try {
      if (isRecording) return;
      recognitionRef.current?.start();
      setIsRecording(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setDebug(`Error starting speech recognition: ${errorMessage}`);
    }
  }, [isAvatarTalking, isRecording, initializeSpeechRecognition]);

  // Stop recording
  const stopRecording = useCallback(() => {
    try {
      if (recognitionRef.current && isRecording) {
        recognitionRef.current.stop();
        setIsRecording(false);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setDebug(`Error stopping speech recognition: ${errorMessage}`);
      setIsRecording(false);
    }
  }, [isRecording]);

  // Start avatar session
  const startSession = useCallback(async () => {
    setIsLoadingSession(true);
    try {
      const newToken = await fetchAccessToken();
      avatar.current = new StreamingAvatar({
        token: newToken,
        basePath: baseApiUrl(),
      });

      avatar.current.on(StreamingEvents.AVATAR_START_TALKING, () => {
        setIsAvatarTalking(true);
        if (isRecording) {
          stopRecording();
        }
      });

      avatar.current.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
        setIsAvatarTalking(false);
        if (chatMode === "voice_mode" && !isRecording) {
          setTimeout(() => startRecording(), 1000);
        }
      });

      avatar.current.on(StreamingEvents.STREAM_DISCONNECTED, () => {
        endSession();
      });

      avatar.current.on(StreamingEvents.STREAM_READY, (event: CustomEvent) => {
        setStream(event.detail);
      });

      const res = await avatar.current.createStartAvatar({
        quality: AvatarQuality.Low,
        avatarName: avatarId,
        knowledgeId: "",
        voice: {
          rate: 1.5,
          emotion: VoiceEmotion.EXCITED,
        },
        language: language,
        disableIdleTimeout: true,
      });

      setData(res);
      const currentSessionId = res?.sessionId || generateSessionId();
      setSessionId(currentSessionId);
      await sendToWebhook("start");

      initializeSpeechRecognition();
      setChatMode("voice_mode");
      setTimeout(() => {
        if (chatMode === "voice_mode" && !isAvatarTalking) {
          startRecording();
        }
      }, 1000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setDebug(`Error starting session: ${errorMessage}`);
      alert("Failed to start avatar session. Please try again.");
    } finally {
      setIsLoadingSession(false);
    }
  }, [
    fetchAccessToken,
    baseApiUrl,
    avatarId,
    language,
    generateSessionId,
    sendToWebhook,
    initializeSpeechRecognition,
    startRecording,
    chatMode,
    isAvatarTalking,
  ]);

  // Handle speak in text mode
  const handleSpeak = useCallback(async () => {
    setIsLoadingRepeat(true);
    if (!avatar.current) {
      setDebug("Avatar API not initialized");
      return;
    }

    try {
      await sendToWebhook(text);
      setText("");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setDebug(`Error in handleSpeak: ${errorMessage}`);
    } finally {
      setIsLoadingRepeat(false);
    }
  }, [text, sendToWebhook]);

  // Interrupt avatar speech
  const handleInterrupt = useCallback(async () => {
    if (!avatar.current) {
      setDebug("Avatar API not initialized");
      return;
    }
    try {
      await avatar.current.interrupt();
      setIsAvatarTalking(false);
      if (chatMode === "voice_mode") {
        setTimeout(() => startRecording(), 1000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setDebug(`Error interrupting: ${errorMessage}`);
    }
  }, [chatMode, startRecording]);

  // End session
  const endSession = useCallback(async () => {
    stopRecording();
    if (avatar.current) {
      try {
        await avatar.current.stopAvatar();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setDebug(`Error ending session: ${errorMessage}`);
      }
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setStream(undefined);
    setSessionId("");
    setLastRecognizedSpeech("");
    setSpeakingError("");
    setIsAvatarTalking(false);
    setIsRecording(false);
  }, [stream, stopRecording]);

  // Test avatar speech
  const testAvatarSpeech = useCallback(async () => {
    if (!avatar.current) {
      setDebug("Avatar API not initialized");
      return;
    }

    try {
      if (isRecording) {
        stopRecording();
      }
      await avatar.current.speak({
        text: "This is a test. Can you hear me?",
        taskType: TaskType.REPEAT,
        taskMode: TaskMode.SYNC,
      });
      setDebug("Test speech completed successfully");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setDebug(`Test speech failed: ${errorMessage}`);
      if (chatMode === "voice_mode") {
        setTimeout(() => startRecording(), 1000);
      }
    }
  }, [chatMode, isRecording, stopRecording, startRecording]);

  // Handle chat mode change
  const handleChangeChatMode = useCallback(
    async (v: string | number) => {
      const newMode = v as "voice_mode" | "text_mode";
      if (newMode === chatMode) return;

      try {
        setChatMode(newMode);
        if (newMode === "text_mode") {
          stopRecording();
        } else if (newMode === "voice_mode" && !isAvatarTalking) {
          setTimeout(() => startRecording(), 500);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        setDebug(`Error changing chat mode: ${errorMessage}`);
      }
    },
    [chatMode, isAvatarTalking, startRecording, stopRecording]
  );

  // Handle text input changes for listening state
  const previousText = usePrevious(text);
  useEffect(() => {
    if (!previousText && text) {
      avatar.current?.startListening();
    } else if (previousText && !text) {
      avatar.current?.stopListening();
    }
  }, [text, previousText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endSession();
    };
  }, [endSession]);

  // Handle stream assignment
  useEffect(() => {
    if (stream && mediaStream.current) {
      mediaStream.current.srcObject = stream;
      mediaStream.current.onloadedmetadata = () => {
        mediaStream.current!.play();
        setDebug("Playing");
      };
    }
  }, [stream]);

  return (
    <div className="w-full flex flex-col gap-4">
      <Card>
        <CardBody className="h-[500px] flex flex-col justify-center items-center">
          {stream ? (
            <div className="h-[500px] w-[900px] justify-center items-center flex rounded-lg overflow-hidden">
              <video
                ref={mediaStream}
                autoPlay
                playsInline
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              >
                <track kind="captions" />
              </video>
              <div className="flex flex-col gap-2 absolute bottom-3 right-3">
                <Button
                  aria-label="Test avatar speech"
                  className="bg-gradient-to-tr from-indigo-500 to-indigo-300 text-white rounded-lg"
                  size="md"
                  variant="shadow"
                  onClick={testAvatarSpeech}
                  isDisabled={!stream}
                >
                  Test Speech
                </Button>
                <Button
                  aria-label="Interrupt avatar speech"
                  className="bg-gradient-to-tr from-indigo-500 to-indigo-300 text-white rounded-lg"
                  size="md"
                  variant="shadow"
                  onClick={handleInterrupt}
                  isDisabled={!stream || !isAvatarTalking}
                >
                  Interrupt task
                </Button>
                <Button
                  aria-label="End avatar session"
                  className="bg-gradient-to-tr from-indigo-500 to-indigo-300 text-white rounded-lg"
                  size="md"
                  variant="shadow"
                  onClick={endSession}
                  isDisabled={!stream}
                >
                  End session
                </Button>
              </div>
            </div>
          ) : !isLoadingSession ? (
            <div className="h-full justify-center items-center flex flex-col gap-8 w-[500px] self-center">
              <div className="flex flex-col gap-2 w-full">
                <p className="text-sm font-medium leading-none">
                  Custom Knowledge ID (optional)
                </p>
                <Input
                  aria-label="Custom Knowledge ID"
                  placeholder="Enter a custom knowledge ID"
                  value={knowledgeId}
                  onChange={(e) => setKnowledgeId(e.target.value)}
                />
                <p className="text-sm font-medium leading-none">
                  Custom Avatar ID (optional)
                </p>
                <Input
                  aria-label="Custom Avatar ID"
                  placeholder="Enter a custom avatar ID"
                  value={avatarId}
                  onChange={(e) => setAvatarId(e.target.value)}
                />
                <Select
                  aria-label="Select example avatar"
                  placeholder="Or select one from these example avatars"
                  size="md"
                  onChange={(e) => setAvatarId(e.target.value)}
                >
                  {AVATARS.map((avatar) => (
                    <SelectItem
                      key={avatar.avatar_id}
                      textValue={avatar.avatar_id}
                    >
                      {avatar.name}
                    </SelectItem>
                  ))}
                </Select>
                <Select
                  label="Select language"
                  aria-label="Select language"
                  placeholder="Select language"
                  className="max-w-xs"
                  selectedKeys={[language]}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  {STT_LANGUAGE_LIST.map((lang) => (
                    <SelectItem key={lang.key}>{lang.label}</SelectItem>
                  ))}
                </Select>
              </div>
              <Button
                aria-label="Start avatar session"
                className="bg-gradient-to-tr from-indigo-500 to-indigo-300 w-full text-white"
                size="md"
                variant="shadow"
                onClick={startSession}
              >
                Start session
              </Button>
            </div>
          ) : (
            <Spinner color="default" size="lg" />
          )}
        </CardBody>
        <Divider />
        <CardFooter className="flex flex-col gap-3 relative">
          <Tabs
            aria-label="Chat mode options"
            selectedKey={chatMode}
            onSelectionChange={handleChangeChatMode}
          >
            <Tab key="text_mode" title="Text mode" />
            <Tab key="voice_mode" title="Voice mode" />
          </Tabs>
          <div aria-live="polite" className="sr-only">
            {isAvatarTalking
              ? "Avatar is speaking"
              : isRecording
              ? "Listening for voice input"
              : "Idle"}
          </div>
          {chatMode === "text_mode" ? (
            <div className="w-full flex relative">
              <InteractiveAvatarTextInput
                disabled={!stream || processingWebhook || isAvatarTalking}
                input={text}
                label="Chat"
                loading={isLoadingRepeat || processingWebhook}
                placeholder="Type something for the avatar to respond"
                setInput={setText}
                onSubmit={handleSpeak}
              />
              {text && (
                <Chip className="absolute right-16 top-3">Listening</Chip>
              )}
              {isAvatarTalking && (
                <Chip color="primary" className="absolute right-32 top-3">
                  Avatar Speaking
                </Chip>
              )}
              {processingWebhook && (
                <Chip color="warning" className="absolute right-48 top-3">
                  Processing
                </Chip>
              )}
              {speakingError && (
                <Chip color="danger" className="absolute right-64 top-3">
                  Speech Error
                </Chip>
              )}
            </div>
          ) : (
            <div className="w-full text-center flex flex-col gap-2">
              <div className="flex justify-center items-center gap-2">
                {isUserTalking && !isAvatarTalking && (
                  <Chip color="success" className="animate-pulse">
                    Listening
                  </Chip>
                )}
                {isRecording && !isUserTalking && !isAvatarTalking && (
                  <Chip color="primary">Ready for voice input</Chip>
                )}
                {isAvatarTalking && (
                  <Chip color="secondary" className="animate-pulse">
                    Avatar Speaking
                  </Chip>
                )}
                {processingWebhook && <Chip color="warning">Processing</Chip>}
                {speakingError && <Chip color="danger">Speech Error</Chip>}
              </div>
              {lastRecognizedSpeech && !isAvatarTalking && (
                <div className="p-2 bg-gray-100 rounded-lg text-center max-w-lg mx-auto">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">You said:</span>{" "}
                    {lastRecognizedSpeech}
                  </p>
                </div>
              )}
              <div className="flex justify-center gap-2 mt-2">
                {(!isRecording && !isAvatarTalking) ? (
                  <Button
                    aria-label="Start voice input"
                    color="success"
                    onClick={startRecording}
                    isDisabled={!stream || isAvatarTalking}
                    title={
                      isAvatarTalking
                        ? "Cannot start while avatar is speaking"
                        : undefined
                    }
                  >
                    Start Voice Input
                  </Button>
                ) : (
                  <Button
                    aria-label="Stop voice input"
                    color="danger"
                    onClick={stopRecording}
                    isDisabled={isAvatarTalking}
                    title={
                      isAvatarTalking
                        ? "Cannot stop while avatar is speaking"
                        : undefined
                    }
                  >
                    Stop Voice Input
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardFooter>
      </Card>
      <p className="font-mono text-right">
        <span className="font-bold">Console:</span>
        <br />
        {debug}
        {speakingError && (
          <>
            <br />
            <span className="text-red-500">Speaking Error: {speakingError}</span>
          </>
        )}
      </p>
    </div>
  );
}