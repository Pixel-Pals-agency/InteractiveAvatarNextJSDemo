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
import { useMemoizedFn, usePrevious } from "ahooks";

import InteractiveAvatarTextInput from "./InteractiveAvatarTextInput";

import { AVATARS, STT_LANGUAGE_LIST } from "@/app/lib/constants";

const WEBHOOK_URL = "https://n8n.fastynet.click/webhook/b68e20df-39d6-4baa-a862-5b5f6b9bbcc6/chat";

export default function InteractiveAvatar() {
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isLoadingRepeat, setIsLoadingRepeat] = useState(false);
  const [stream, setStream] = useState<MediaStream>();
  const [debug, setDebug] = useState<string>();
  const [knowledgeId, setKnowledgeId] = useState<string>("");
  const [avatarId, setAvatarId] = useState<string>("");
  const [language, setLanguage] = useState<string>("en");
  const [sessionId, setSessionId] = useState<string>("");
  // Add a ref to store the session ID that can be accessed synchronously
  const sessionIdRef = useRef<string>("");

  const [data, setData] = useState<StartAvatarResponse>();
  const [text, setText] = useState<string>("");
  const mediaStream = useRef<HTMLVideoElement>(null);
  const avatar = useRef<StreamingAvatar | null>(null);
  const [chatMode, setChatMode] = useState("text_mode");
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [processingWebhook, setProcessingWebhook] = useState(false);
  const [speakingError, setSpeakingError] = useState<string>("");
  const [lastRecognizedSpeech, setLastRecognizedSpeech] = useState<string>("");
  
  // New state and refs for custom speech recognition
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Function to generate a session ID if one isn't provided by the API
  const generateSessionId = () => {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  };

  function baseApiUrl() {
    return process.env.NEXT_PUBLIC_BASE_API_URL;
  }

  async function fetchAccessToken() {
    try {
      const response = await fetch("/api/get-access-token", {
        method: "POST",
      });
      const token = await response.text();

      console.log("Access Token:", token); // Log the token to verify

      return token;
    } catch (error) {
      console.error("Error fetching access token:", error);
    }

    return "";
  }

  // Function to send messages to webhook
  async function sendToWebhook(message: string) {
    setProcessingWebhook(true);
    try {
      // Log the current session ID for debugging
      console.log("Sending to webhook with sessionId:", sessionIdRef.current);
      
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          message: message
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook response error: ${response.status}`);
      }

      const responseData = await response.json();
      console.log("Webhook response:", responseData);
      
      // Have the avatar speak the response
      if (responseData && (responseData.response || responseData.output)) {
        const textToSpeak = responseData.response || responseData.output;
        console.log("Webhook response to speak:", textToSpeak);
        
        // Check if avatar instance exists
        if (!avatar.current) {
          console.error("Avatar instance is null when trying to speak webhook response");
          setDebug("Avatar instance is null when trying to speak webhook response");
          return;
        }

        try {
          // Make sure we're not interrupting a current speech task
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Clean up the output if it contains analysis tags
          const cleanedText = textToSpeak.includes('<analysis>') 
            ? textToSpeak.replace(/<analysis>[\s\S]*?<\/analysis>/g, '').trim()
            : textToSpeak;
          
          console.log("Calling avatar speak with cleaned text:", cleanedText);
          
          await avatar.current.speak({ 
            text: cleanedText, 
            taskType: TaskType.REPEAT, 
            taskMode: TaskMode.SYNC 
          });
          
          console.log("Avatar speak method called successfully");
        } catch (error) {
          console.error("Error making avatar speak:", error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          setSpeakingError(errorMessage);
          setDebug(`Avatar speak error: ${errorMessage}`);
        }
      } else {
        console.warn("No response text found in webhook response data", responseData);
        setDebug("No response text found in webhook response data");
      }

      return responseData;
    } catch (error) {
      console.error("Error sending to webhook:", error);
      setDebug(`Webhook error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setProcessingWebhook(false);
    }
  }

  // Initialize and start Web Speech API recognition
  const initializeSpeechRecognition = () => {
    // Check if the browser supports the Web Speech API
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setDebug("Speech recognition is not supported in this browser");
      return;
    }
    
    // Create a new SpeechRecognition instance
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    // Configure recognition settings
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = language;
    
    // Event handlers
    recognition.onstart = () => {
      console.log("Speech recognition started");
      setIsUserTalking(true);
    };
    
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
        
      console.log("Speech recognition interim result:", transcript);
      setLastRecognizedSpeech(transcript);
    };
    
    recognition.onend = async () => {
      console.log("Speech recognition ended");
      setIsUserTalking(false);
      
      if (lastRecognizedSpeech && chatMode === "voice_mode") {
        await sendToWebhook(lastRecognizedSpeech);
      }
      
      // Restart recognition for continuous listening
      if (chatMode === "voice_mode" && isRecording) {
        try {
          recognition.start();
        } catch (error) {
          console.error("Error restarting speech recognition:", error);
        }
      }
    };
    
    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setDebug(`Speech recognition error: ${event.error}`);
      setIsUserTalking(false);
    };
    
    recognitionRef.current = recognition;
  };
  
  // Start recording with Web Speech API
  const startRecording = () => {
    if (!recognitionRef.current) {
      initializeSpeechRecognition();
    }
    
    try {
      recognitionRef.current?.start();
      setIsRecording(true);
      console.log("Started recording with Web Speech API");
    } catch (error) {
      console.error("Error starting speech recognition:", error);
      setDebug(`Error starting speech recognition: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  // Stop recording
  const stopRecording = () => {
    try {
      recognitionRef.current?.stop();
      setIsRecording(false);
      console.log("Stopped recording with Web Speech API");
    } catch (error) {
      console.error("Error stopping speech recognition:", error);
    }
  };

  async function startSession() {
    setIsLoadingSession(true);
    const newToken = await fetchAccessToken();

    avatar.current = new StreamingAvatar({
      token: newToken,
      basePath: baseApiUrl(),
    });
    avatar.current.on(StreamingEvents.AVATAR_START_TALKING, (e) => {
      console.log("Avatar started talking", e);
    });
    avatar.current.on(StreamingEvents.AVATAR_STOP_TALKING, (e) => {
      console.log("Avatar stopped talking", e);
    });
    avatar.current.on(StreamingEvents.STREAM_DISCONNECTED, () => {
      console.log("Stream disconnected");
      endSession();
    });
    avatar.current?.on(StreamingEvents.STREAM_READY, (event) => {
      console.log(">>>>> Stream ready:", event.detail);
      setStream(event.detail);
    });
    
    try {
      const res = await avatar.current.createStartAvatar({
        quality: AvatarQuality.Low,
        avatarName: avatarId,
        knowledgeId: "", // Set to empty string to bypass HeyGen's internal knowledge processing
        voice: {
          rate: 1.5,
          emotion: VoiceEmotion.EXCITED,
        },
        language: language,
        disableIdleTimeout: true,
      });

      console.log("Full response from createStartAvatar:", res);
      setData(res);
      
      // Use response session ID or generate our own
      const currentSessionId = (res && res.sessionId) ? res.sessionId : generateSessionId();
      
      // Store the session ID
      setSessionId(currentSessionId);
      sessionIdRef.current = currentSessionId;
      console.log("Session ID set to:", currentSessionId);
      
      // Send initial "start" message to webhook
      await sendToWebhook("start");
      
      // Initialize our custom speech recognition instead of HeyGen's
      initializeSpeechRecognition();
      
      // default to voice mode and start recording
      setChatMode("voice_mode");
      startRecording();
    } catch (error) {
      console.error("Error starting avatar session:", error);
      setDebug(`Error starting session: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoadingSession(false);
    }
  }
  
  async function handleSpeak() {
    setIsLoadingRepeat(true);
    if (!avatar.current) {
      setDebug("Avatar API not initialized");
      return;
    }
    
    try {
      // First send the text to webhook and get response
      await sendToWebhook(text);
      // The webhook response will be handled in sendToWebhook function
      
      // Clear the input text after sending
      setText("");
    } catch (error) {
      console.error("Error in handleSpeak:", error);
      setDebug(`Error in handleSpeak: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoadingRepeat(false);
    }
  }
  
  async function handleInterrupt() {
    if (!avatar.current) {
      setDebug("Avatar API not initialized");
      return;
    }
    try {
      await avatar.current.interrupt();
      console.log("Successfully interrupted avatar speech");
    } catch (e) {
      console.error("Error interrupting:", e);
      setDebug(`Error interrupting: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  
  async function endSession() {
    // Stop our custom speech recognition
    stopRecording();
    
    if (avatar.current) {
      try {
        await avatar.current.stopAvatar();
        console.log("Avatar session ended successfully");
      } catch (e) {
        console.error("Error ending session:", e);
      }
    }
    setStream(undefined);
    setSessionId("");
    sessionIdRef.current = ""; // Reset the ref as well
    setLastRecognizedSpeech("");
    setSpeakingError("");
  }

  // Test avatar speaking capability
  async function testAvatarSpeech() {
    if (!avatar.current) {
      setDebug("Avatar API not initialized");
      return;
    }

    try {
      console.log("Testing avatar speech with a simple message");
      await avatar.current.speak({
        text: "This is a test. Can you hear me?",
        taskType: TaskType.REPEAT,
        taskMode: TaskMode.SYNC
      });
      console.log("Test speech completed successfully");
      setDebug("Test speech completed successfully");
    } catch (error) {
      console.error("Test speech failed:", error);
      setDebug(`Test speech failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const handleChangeChatMode = useMemoizedFn(async (v) => {
    if (v === chatMode) {
      return;
    }
    
    try {
      if (v === "text_mode") {
        // Stop our custom speech recognition when switching to text mode
        stopRecording();
      } else {
        // Start our custom speech recognition when switching to voice mode
        startRecording();
      }
      setChatMode(v);
    } catch (error) {
      console.error("Error changing chat mode:", error);
      setDebug(`Error changing chat mode: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  const previousText = usePrevious(text);
  useEffect(() => {
    if (!previousText && text) {
      avatar.current?.startListening();
    } else if (previousText && !text) {
      avatar?.current?.stopListening();
    }
  }, [text, previousText]);

  useEffect(() => {
    return () => {
      endSession();
    };
  }, []);

  useEffect(() => {
    if (stream && mediaStream.current) {
      mediaStream.current.srcObject = stream;
      mediaStream.current.onloadedmetadata = () => {
        mediaStream.current!.play();
        setDebug("Playing");
      };
    }
  }, [mediaStream, stream]);

  // Control the recording status when chat mode changes
  useEffect(() => {
    if (chatMode === "voice_mode" && stream) {
      startRecording();
    } else if (chatMode === "text_mode") {
      stopRecording();
    }
  }, [chatMode, stream]);

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
                  className="bg-gradient-to-tr from-indigo-500 to-indigo-300 text-white rounded-lg"
                  size="md"
                  variant="shadow"
                  onClick={testAvatarSpeech}
                >
                  Test Speech
                </Button>
                <Button
                  className="bg-gradient-to-tr from-indigo-500 to-indigo-300 text-white rounded-lg"
                  size="md"
                  variant="shadow"
                  onClick={handleInterrupt}
                >
                  Interrupt task
                </Button>
                <Button
                  className="bg-gradient-to-tr from-indigo-500 to-indigo-300  text-white rounded-lg"
                  size="md"
                  variant="shadow"
                  onClick={endSession}
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
                  placeholder="Enter a custom knowledge ID"
                  value={knowledgeId}
                  onChange={(e) => setKnowledgeId(e.target.value)}
                />
                <p className="text-sm font-medium leading-none">
                  Custom Avatar ID (optional)
                </p>
                <Input
                  placeholder="Enter a custom avatar ID"
                  value={avatarId}
                  onChange={(e) => setAvatarId(e.target.value)}
                />
                <Select
                  placeholder="Or select one from these example avatars"
                  size="md"
                  onChange={(e) => {
                    setAvatarId(e.target.value);
                  }}
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
                  placeholder="Select language"
                  className="max-w-xs"
                  selectedKeys={[language]}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                  }}
                >
                  {STT_LANGUAGE_LIST.map((lang) => (
                    <SelectItem key={lang.key}>{lang.label}</SelectItem>
                  ))}
                </Select>
              </div>
              <Button
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
            aria-label="Options"
            selectedKey={chatMode}
            onSelectionChange={(v) => {
              handleChangeChatMode(v);
            }}
          >
            <Tab key="text_mode" title="Text mode" />
            <Tab key="voice_mode" title="Voice mode" />
          </Tabs>
          {chatMode === "text_mode" ? (
            <div className="w-full flex relative">
              <InteractiveAvatarTextInput
                disabled={!stream || processingWebhook}
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
              {processingWebhook && (
                <Chip color="warning" className="absolute right-32 top-3">Processing</Chip>
              )}
              {speakingError && (
                <Chip color="danger" className="absolute right-48 top-3">Speech Error</Chip>
              )}
            </div>
          ) : (
            <div className="w-full text-center flex flex-col gap-2">
              <div className="flex justify-center items-center gap-2">
                {isUserTalking && (
                  <Chip color="success" className="animate-pulse">Listening</Chip>
                )}
                {isRecording && !isUserTalking && (
                  <Chip color="primary">Ready for voice input</Chip>
                )}
                {processingWebhook && (
                  <Chip color="warning">Processing</Chip>
                )}
                {speakingError && (
                  <Chip color="danger">Speech Error</Chip>
                )}
              </div>
              {lastRecognizedSpeech && (
                <div className="p-2 bg-gray-100 rounded-lg text-center max-w-lg mx-auto">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">You said:</span> {lastRecognizedSpeech}
                  </p>
                </div>
              )}
              <div className="flex justify-center gap-2 mt-2">
                {!isRecording ? (
                  <Button 
                    color="success" 
                    onClick={startRecording} 
                    disabled={!stream}
                  >
                    Start Voice Input
                  </Button>
                ) : (
                  <Button 
                    color="danger" 
                    onClick={stopRecording}
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