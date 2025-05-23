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
  Spinner,
  Chip,
  Tabs,
  Tab,
} from "@nextui-org/react";
import { useEffect, useRef, useState } from "react";
import { useMemoizedFn, usePrevious } from "ahooks";

import InteractiveAvatarTextInput from "./InteractiveAvatarTextInput";

const WEBHOOK_URL = "https://n8n.fastynet.click/webhook/b68e20df-39d6-4baa-a862-5b5f6b9bbcc6/chat";
const DEFAULT_AVATAR_ID = "Katya_Chair_Sitting_public";
const DEFAULT_LANGUAGE = "en";

// Add TypeScript interfaces for Web Speech API
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

// Add the missing interface declarations for window
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export default function InteractiveAvatar() {
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isLoadingRepeat, setIsLoadingRepeat] = useState(false);
  const [stream, setStream] = useState<MediaStream>();
  const [debug, setDebug] = useState<string>();
  const [sessionId, setSessionId] = useState<string>("");
  // Add a ref to store the session ID that can be accessed synchronously
  const sessionIdRef = useRef<string>("");

  const [data, setData] = useState<StartAvatarResponse>();
  const [text, setText] = useState<string>("");
  const mediaStream = useRef<HTMLVideoElement>(null);
  const avatar = useRef<StreamingAvatar | null>(null);
  const [chatMode, setChatMode] = useState("voice_mode");
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [processingWebhook, setProcessingWebhook] = useState(false);
  const [speakingError, setSpeakingError] = useState<string>("");
  const [lastRecognizedSpeech, setLastRecognizedSpeech] = useState<string>("");
  
  // New state and refs for custom speech recognition
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isAvatarTalking, setIsAvatarTalking] = useState(false);
  
  // New ref to track if we need to restart recognition after avatar stops
  const shouldRestartRecognitionRef = useRef(false);
  
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

  // Function to send messages to webhook with improved debugging
  async function sendToWebhook(message: string) {
    console.log("sendToWebhook called with:", message);
    
    if (!message || message.trim() === "") {
      console.log("Empty message, not sending to webhook");
      return;
    }
    
    if (!sessionIdRef.current) {
      console.error("No session ID available, cannot send to webhook");
      setDebug("Error: No session ID available for webhook");
      return;
    }
    
    setProcessingWebhook(true);
    try {
      // Log the current session ID for debugging
      console.log("Sending to webhook with sessionId:", sessionIdRef.current);
      
      const payload = {
        sessionId: sessionIdRef.current,
        message: message
      };
      
      console.log("Webhook payload:", payload);
      
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log("Webhook response status:", response.status);

      if (!response.ok) {
        throw new Error(`Webhook response error: ${response.status}`);
      }

      const responseData = await response.json();
      console.log("Webhook response data:", responseData);
      
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
          
          // Make sure speech recognition is completely stopped before avatar talks
          if (recognitionRef.current && isRecording) {
            console.log("Stopping speech recognition before avatar speaks");
            stopRecording();
            
            // Set flag to restart recognition after avatar stops talking
            shouldRestartRecognitionRef.current = true;
          }
          
          // Set the avatar talking state before speaking
          setIsAvatarTalking(true);
          
          await avatar.current.speak({ 
            text: cleanedText, 
            taskType: TaskType.REPEAT, 
            taskMode: TaskMode.SYNC 
          });
          
          // Don't rely only on events - set state here too to ensure it updates
          setIsAvatarTalking(false);
          
          console.log("Avatar speak method completed successfully");
          
          // We'll restart speech recognition in the AVATAR_STOP_TALKING event handler
        } catch (error) {
          console.error("Error making avatar speak:", error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          setSpeakingError(errorMessage);
          setDebug(`Avatar speak error: ${errorMessage}`);
          setIsAvatarTalking(false);
          
          // Restart speech recognition if avatar fails to speak and we're in voice mode
          if (chatMode === "voice_mode") {
            console.log("Restarting speech recognition after avatar speaking error");
            setTimeout(() => startRecording(), 1000);
          }
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

  // Initialize and start Web Speech API recognition with improved configuration
  const initializeSpeechRecognition = () => {
    // Check if the browser supports the Web Speech API
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setDebug("Speech recognition is not supported in this browser");
      return;
    }
    
    // Create a new SpeechRecognition instance
    const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionConstructor();
    
    // Configure recognition settings
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = DEFAULT_LANGUAGE;
    
    // Add logging for configuration
    console.log("Speech recognition configured:", {
      continuous: recognition.continuous,
      interimResults: recognition.interimResults,
      lang: recognition.lang
    });
    
    // Event handlers with improved logging
    recognition.onstart = () => {
      console.log("Speech recognition started");
      setIsUserTalking(true);
      setIsRecording(true);
    };
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Skip processing results if avatar is talking
      if (isAvatarTalking) {
        console.log("Skipping speech recognition results while avatar is talking");
        return;
      }
      
      // Find the most recent final result or use interim if none final yet
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
          console.log("Final transcript:", finalTranscript);
        } else {
          interimTranscript += transcript;
        }
      }
      
      // If we have a final transcript, use it
      if (finalTranscript) {
        console.log("Setting final transcript:", finalTranscript);
        setLastRecognizedSpeech(finalTranscript);
        
        // Send final results immediately
        if (finalTranscript.trim() !== "") {
          console.log("Final result detected, sending to webhook");
          sendToWebhook(finalTranscript);
          
          // Stop recognition briefly to reset the recognition context
          recognition.stop();
        }
      } else if (interimTranscript) {
        // Just show interim results to the user
        console.log("Setting interim transcript:", interimTranscript);
        setLastRecognizedSpeech(interimTranscript);
      }
    };
    
    recognition.onend = async () => {
      console.log("Speech recognition ended");
      setIsUserTalking(false);
      setIsRecording(false);
      
      // Get the current transcript before any state changes
      const currentTranscript = lastRecognizedSpeech;
      
      // If we have a transcript that hasn't been sent yet, send it now
      if (currentTranscript && currentTranscript.trim() !== "" && !isAvatarTalking) {
        console.log("Sending transcript to webhook from onend:", currentTranscript);
        
        // Clear the transcript for next recognition AFTER capturing it
        setLastRecognizedSpeech("");
        
        // Send the transcribed text to webhook
        await sendToWebhook(currentTranscript);
      }
      
      // Only restart recognition if we're not in avatar talking state and in voice mode
      if (chatMode === "voice_mode" && !isAvatarTalking) {
        try {
          console.log("Auto-restarting speech recognition after end event");
          setTimeout(() => {
            if (chatMode === "voice_mode" && !isAvatarTalking) {
              console.log("Restarting speech recognition");
              recognition.start();
              setIsRecording(true);
            }
          }, 1000);
        } catch (error) {
          console.error("Error restarting speech recognition:", error);
        }
      }
    };
    
    recognition.onerror = (event: SpeechRecognitionEvent) => {
      console.error("Speech recognition error:", event.error);
      setDebug(`Speech recognition error: ${event.error}`);
      setIsUserTalking(false);
      setIsRecording(false);
    };
    
    recognitionRef.current = recognition;
  };
  
  // Start recording with Web Speech API
  const startRecording = () => {
    // Don't start if avatar is talking
    if (isAvatarTalking) {
      console.log("Cannot start recording while avatar is talking");
      return;
    }
    
    if (!recognitionRef.current) {
      initializeSpeechRecognition();
    }
    
    try {
      // Check if we already have an existing recognition session
      if (isRecording) {
        console.log("Speech recognition is already running");
        return;
      }
      
      console.log("Starting speech recognition");
      recognitionRef.current?.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting speech recognition:", error);
      setDebug(`Error starting speech recognition: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  // Stop recording
  const stopRecording = () => {
    try {
      if (recognitionRef.current && isRecording) {
        console.log("Stopping speech recognition");
        recognitionRef.current.stop();
        setIsRecording(false);
      } else {
        console.log("Speech recognition is not running, nothing to stop");
      }
    } catch (error) {
      console.error("Error stopping speech recognition:", error);
      setIsRecording(false); // Force state update even if there's an error
    }
  };

  async function startSession() {
    setIsLoadingSession(true);
    const newToken = await fetchAccessToken();

    avatar.current = new StreamingAvatar({
      token: newToken,
      basePath: baseApiUrl(),
    });
    
    // Add event listeners for avatar talking state
    avatar.current.on(StreamingEvents.AVATAR_START_TALKING, (e) => {
      console.log("Avatar started talking", e);
      
      // First, ensure speech recognition is stopped
      if (recognitionRef.current && isRecording) {
        console.log("Stopping speech recognition due to avatar start talking");
        stopRecording();
      }
      
      // Then update the avatar talking state
      setIsAvatarTalking(true);
      
      // Set flag to restart recognition after avatar stops talking (if in voice mode)
      if (chatMode === "voice_mode") {
        shouldRestartRecognitionRef.current = true;
      }
    });
    
    avatar.current.on(StreamingEvents.AVATAR_STOP_TALKING, (e) => {
      console.log("Avatar stopped talking", e);
      setIsAvatarTalking(false);
      
      // Check if we should restart speech recognition
      if (shouldRestartRecognitionRef.current && chatMode === "voice_mode") {
        console.log("Restarting speech recognition after avatar stopped talking");
        // Add a delay to make sure the avatar has fully stopped talking
        setTimeout(() => {
          if (!isAvatarTalking && chatMode === "voice_mode") {
            startRecording();
          }
        }, 1000);
        
        // Reset the flag
        shouldRestartRecognitionRef.current = false;
      }
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
        avatarName: DEFAULT_AVATAR_ID,
        knowledgeId: "", // Set to empty string to bypass HeyGen's internal knowledge processing
        voice: {
          rate: 1.5,
          emotion: VoiceEmotion.EXCITED,
        },
        language: DEFAULT_LANGUAGE,
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
      
      // Initialize our custom speech recognition
      initializeSpeechRecognition();
      
      // Always set to voice mode when starting session
      setChatMode("voice_mode");
      
      // Give a bit of time for everything to initialize before starting recording
      setTimeout(() => {
        if (chatMode === "voice_mode" && !isAvatarTalking) {
          startRecording();
        }
      }, 1000);
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
      setIsAvatarTalking(false);
      
      // Resume speech recognition after interrupting if in voice mode
      if (chatMode === "voice_mode") {
        console.log("Restarting speech recognition after interruption");
        setTimeout(() => startRecording(), 1000);
      }
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
    setIsAvatarTalking(false);
    shouldRestartRecognitionRef.current = false;
  }

  // Test avatar speaking capability
  async function testAvatarSpeech() {
    if (!avatar.current) {
      setDebug("Avatar API not initialized");
      return;
    }

    try {
      console.log("Testing avatar speech with a simple message");
      // Stop speech recognition during test
      if (isRecording) {
        stopRecording();
      }
      
      // Set flag to restart recognition after test (if in voice mode)
      if (chatMode === "voice_mode") {
        shouldRestartRecognitionRef.current = true;
      }
      
      setIsAvatarTalking(true);
      
      await avatar.current.speak({
        text: "This is a test. Can you hear me?",
        taskType: TaskType.REPEAT,
        taskMode: TaskMode.SYNC
      });
      
      setIsAvatarTalking(false);
      
      console.log("Test speech completed successfully");
      setDebug("Test speech completed successfully");
    } catch (error) {
      console.error("Test speech failed:", error);
      setDebug(`Test speech failed: ${error instanceof Error ? error.message : String(error)}`);
      setIsAvatarTalking(false);
      
      // Resume speech recognition after error
      if (chatMode === "voice_mode") {
        setTimeout(() => startRecording(), 1000);
      }
    }
  }

  const handleChangeChatMode = useMemoizedFn(async (v) => {
    if (v === chatMode) {
      return;
    }
    
    try {
      // Update mode first
      setChatMode(v);
      
      // Handle mode-specific actions
      if (v === "text_mode") {
        // Stop our custom speech recognition when switching to text mode
        stopRecording();
        shouldRestartRecognitionRef.current = false;
      } else if (v === "voice_mode" && !isAvatarTalking) {
        // Start our custom speech recognition when switching to voice mode
        setTimeout(() => startRecording(), 500);
      }
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

  // Handle changes to avatar talking state
  useEffect(() => {
    if (isAvatarTalking) {
      // Make sure speech recognition is stopped when avatar starts talking
      if (isRecording) {
        console.log("Effect: Stopping speech recognition because avatar started talking");
        stopRecording();
      }
    } else if (chatMode === "voice_mode" && !isAvatarTalking && shouldRestartRecognitionRef.current) {
      // Restart speech recognition when avatar stops talking (if flag is set)
      console.log("Effect: Avatar stopped talking, restarting speech recognition");
      setTimeout(() => {
        if (!isAvatarTalking && chatMode === "voice_mode") {
          startRecording();
          shouldRestartRecognitionRef.current = false;
        }
      }, 1000);
    }
  }, [isAvatarTalking, chatMode]);
  
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
                <Chip color="primary" className="absolute right-32 top-3">Avatar Speaking</Chip>
              )}
              {processingWebhook && (
                <Chip color="warning" className="absolute right-48 top-3">Processing</Chip>
              )}
              {speakingError && (
                <Chip color="danger" className="absolute right-64 top-3">Speech Error</Chip>
              )}
            </div>
          ) : (
            <div className="w-full text-center flex flex-col gap-2">
              <div className="flex justify-center items-center gap-2">
                {isUserTalking && !isAvatarTalking && (
                  <Chip color="success" className="animate-pulse">Listening</Chip>
                )}
                {isRecording && !isUserTalking && !isAvatarTalking && (
                  <Chip color="primary">Ready for voice input</Chip>
                )}
                {isAvatarTalking && (
                  <Chip color="secondary" className="animate-pulse">Avatar Speaking</Chip>
                )}
                {processingWebhook && (
                  <Chip color="warning">Processing</Chip>
                )}
                {speakingError && (
                  <Chip color="danger">Speech Error</Chip>
                )}
              </div>
              {lastRecognizedSpeech && !isAvatarTalking && (
                <div className="p-2 bg-gray-100 rounded-lg text-center max-w-lg mx-auto">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">You said:</span> {lastRecognizedSpeech}
                  </p>
                </div>
              )}
              <div className="flex justify-center gap-2 mt-2">
                {(!isRecording && !isAvatarTalking) ? (
                  <Button 
                    color="success" 
                    onClick={startRecording} 
                    disabled={!stream || isAvatarTalking}
                  >
                    Start Voice Input
                  </Button>
                ) : (
                  <Button 
                    color="danger" 
                    onClick={stopRecording}
                    disabled={isAvatarTalking}
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