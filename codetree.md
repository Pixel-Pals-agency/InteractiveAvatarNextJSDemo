## Additional Info
# Files Structure
```
app/
  api/
    get-access-token/
      route.ts
  lib/
    constants.ts
  error.tsx
  layout.tsx
  page.tsx
  providers.tsx
components/
  Icons.tsx
  InteractiveAvatar.tsx
  InteractiveAvatarCode.tsx
  InteractiveAvatarTextInput.tsx
  NavBar.tsx
  ThemeSwitch.tsx
styles/
  globals.css
.eslintignore
.eslintrc.json
.gitignore
.npmrc
LICENSE
next.config.js
package.json
postcss.config.js
README.md
tailwind.config.js
tsconfig.json
```

# Repository Files

## File: app/api/get-access-token/route.ts
```typescript
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

export async function POST() {
  try {
    if (!HEYGEN_API_KEY) {
      throw new Error("API key is missing from .env");
    }
    const baseApiUrl = process.env.NEXT_PUBLIC_BASE_API_URL;

    const res = await fetch(`${baseApiUrl}/v1/streaming.create_token`, {
      method: "POST",
      headers: {
        "x-api-key": HEYGEN_API_KEY,
      },
    });

    const data = await res.json();
    return new Response(data.data.token, {
      status: 200,
    });
  } catch (error) {
    console.error("Error retrieving access token:", error);

    return new Response("Failed to retrieve access token", {
      status: 500,
    });
  }
}
```

## File: app/lib/constants.ts
```typescript
export const AVATARS = [
  {
    avatar_id: "Ann_Therapist_public",
    name: "Ann Therapist",
  },
  {
    avatar_id: "Shawn_Therapist_public",
    name: "Shawn Therapist",
  },
  {
    avatar_id: "Bryan_FitnessCoach_public",
    name: "Bryan Fitness Coach",
  },
  {
    avatar_id: "Dexter_Doctor_Standing2_public",
    name: "Dexter Doctor Standing",
  },
  {
    avatar_id: "Elenora_IT_Sitting_public",
    name: "Elenora Tech Expert",
  },
];

export const STT_LANGUAGE_LIST = [
  { label: 'Bulgarian', value: 'bg', key: 'bg' },
  { label: 'Chinese', value: 'zh', key: 'zh' },
  { label: 'Czech', value: 'cs', key: 'cs' },
  { label: 'Danish', value: 'da', key: 'da' },
  { label: 'Dutch', value: 'nl', key: 'nl' },
  { label: 'English', value: 'en', key: 'en' },
  { label: 'Finnish', value: 'fi', key: 'fi' },
  { label: 'French', value: 'fr', key: 'fr' },
  { label: 'German', value: 'de', key: 'de' },
  { label: 'Greek', value: 'el', key: 'el' },
  { label: 'Hindi', value: 'hi', key: 'hi' },
  { label: 'Hungarian', value: 'hu', key: 'hu' },
  { label: 'Indonesian', value: 'id', key: 'id' },
  { label: 'Italian', value: 'it', key: 'it' },
  { label: 'Japanese', value: 'ja', key: 'ja' },
  { label: 'Korean', value: 'ko', key: 'ko' },
  { label: 'Malay', value: 'ms', key: 'ms' },
  { label: 'Norwegian', value: 'no', key: 'no' },
  { label: 'Polish', value: 'pl', key: 'pl' },
  { label: 'Portuguese', value: 'pt', key: 'pt' },
  { label: 'Romanian', value: 'ro', key: 'ro' },
  { label: 'Russian', value: 'ru', key: 'ru' },
  { label: 'Slovak', value: 'sk', key: 'sk' },
  { label: 'Spanish', value: 'es', key: 'es' },
  { label: 'Swedish', value: 'sv', key: 'sv' },
  { label: 'Turkish', value: 'tr', key: 'tr' },
  { label: 'Ukrainian', value: 'uk', key: 'uk' },
  { label: 'Vietnamese', value: 'vi', key: 'vi' },
];
```

## File: app/error.tsx
```typescript
"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    /* eslint-disable no-console */
    console.error(error);
  }, [error]);

  return (
    <div>
      <h2>Something went wrong!</h2>
      <button
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
      >
        Try again
      </button>
    </div>
  );
}
```

## File: app/layout.tsx
```typescript
import "@/styles/globals.css";
import clsx from "clsx";
import { Metadata, Viewport } from "next";

import { Providers } from "./providers";

import { Fira_Code as FontMono, Inter as FontSans } from "next/font/google";
import NavBar from "@/components/NavBar";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = FontMono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: {
    default: "HeyGen Interactive Avatar SDK Demo",
    template: `%s - HeyGen Interactive Avatar SDK Demo`,
  },
  icons: {
    icon: "/heygen-logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      suppressHydrationWarning
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable} font-sans`}
    >
      <head />
      <body className={clsx("min-h-screen bg-background antialiased")}>
        <Providers themeProps={{ attribute: "class", defaultTheme: "dark" }}>
          <main className="relative flex flex-col h-screen w-screen">
            <NavBar />
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
```

## File: app/page.tsx
```typescript
"use client";

import InteractiveAvatar from "@/components/InteractiveAvatar";
export default function App() {

  return (
    <div className="w-screen h-screen flex flex-col">
      <div className="w-[900px] flex flex-col items-start justify-start gap-5 mx-auto pt-4 pb-20">
        <div className="w-full">
          <InteractiveAvatar />
        </div>
      </div>
    </div>
  );
}
```

## File: app/providers.tsx
```typescript
"use client";

import * as React from "react";
import { NextUIProvider } from "@nextui-org/system";
import { useRouter } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ThemeProviderProps } from "next-themes/dist/types";

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
}

export function Providers({ children, themeProps }: ProvidersProps) {
  const router = useRouter();

  return (
    <NextUIProvider navigate={router.push}>
      <NextThemesProvider {...themeProps}>{children}</NextThemesProvider>
    </NextUIProvider>
  );
}
```

## File: components/Icons.tsx
```typescript
export function HeyGenLogo() {
  return <img src="/heygen-logo.png" className="h-8" alt="HeyGen Logo" />;
}

type IconSvgProps = {
  size?: number;
  width?: number;
  height?: number;
  className?: string;
};

export function GithubIcon({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) {
  return (
    <svg
      height={size || height}
      viewBox="0 0 24 24"
      width={size || width}
      {...props}
    >
      <path
        clipRule="evenodd"
        d="M12.026 2c-5.509 0-9.974 4.465-9.974 9.974 0 4.406 2.857 8.145 6.821 9.465.499.09.679-.217.679-.481 0-.237-.008-.865-.011-1.696-2.775.602-3.361-1.338-3.361-1.338-.452-1.152-1.107-1.459-1.107-1.459-.905-.619.069-.605.069-.605 1.002.07 1.527 1.028 1.527 1.028.89 1.524 2.336 1.084 2.902.829.091-.645.351-1.085.635-1.334-2.214-.251-4.542-1.107-4.542-4.93 0-1.087.389-1.979 1.024-2.675-.101-.253-.446-1.268.099-2.64 0 0 .837-.269 2.742 1.021a9.582 9.582 0 0 1 2.496-.336 9.554 9.554 0 0 1 2.496.336c1.906-1.291 2.742-1.021 2.742-1.021.545 1.372.203 2.387.099 2.64.64.696 1.024 1.587 1.024 2.675 0 3.833-2.33 4.675-4.552 4.922.355.308.675.916.675 1.846 0 1.334-.012 2.41-.012 2.737 0 .267.178.577.687.479C19.146 20.115 22 16.379 22 11.974 22 6.465 17.535 2 12.026 2z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}

export function MoonFilledIcon({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      height={size || height}
      role="presentation"
      viewBox="0 0 24 24"
      width={size || width}
      {...props}
    >
      <path
        d="M21.53 15.93c-.16-.27-.61-.69-1.73-.49a8.46 8.46 0 01-1.88.13 8.409 8.409 0 01-5.91-2.82 8.068 8.068 0 01-1.44-8.66c.44-1.01.13-1.54-.09-1.76s-.77-.55-1.83-.11a10.318 10.318 0 00-6.32 10.21 10.475 10.475 0 007.04 8.99 10 10 0 002.89.55c.16.01.32.02.48.02a10.5 10.5 0 008.47-4.27c.67-.93.49-1.519.32-1.79z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SunFilledIcon({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      height={size || height}
      role="presentation"
      viewBox="0 0 24 24"
      width={size || width}
      {...props}
    >
      <g fill="currentColor">
        <path d="M19 12a7 7 0 11-7-7 7 7 0 017 7z" />
        <path d="M12 22.96a.969.969 0 01-1-.96v-.08a1 1 0 012 0 1.038 1.038 0 01-1 1.04zm7.14-2.82a1.024 1.024 0 01-.71-.29l-.13-.13a1 1 0 011.41-1.41l.13.13a1 1 0 010 1.41.984.984 0 01-.7.29zm-14.28 0a1.024 1.024 0 01-.71-.29 1 1 0 010-1.41l.13-.13a1 1 0 011.41 1.41l-.13.13a1 1 0 01-.7.29zM22 13h-.08a1 1 0 010-2 1.038 1.038 0 011.04 1 .969.969 0 01-.96 1zM2.08 13H2a1 1 0 010-2 1.038 1.038 0 011.04 1 .969.969 0 01-.96 1zm16.93-7.01a1.024 1.024 0 01-.71-.29 1 1 0 010-1.41l.13-.13a1 1 0 011.41 1.41l-.13.13a.984.984 0 01-.7.29zm-14.02 0a1.024 1.024 0 01-.71-.29l-.13-.14a1 1 0 011.41-1.41l.13.13a1 1 0 010 1.41.97.97 0 01-.7.3zM12 3.04a.969.969 0 01-1-.96V2a1 1 0 012 0 1.038 1.038 0 01-1 1.04z" />
      </g>
    </svg>
  );
}
```

## File: components/InteractiveAvatar.tsx
```typescript
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

export default function InteractiveAvatar() {
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isLoadingRepeat, setIsLoadingRepeat] = useState(false);
  const [stream, setStream] = useState<MediaStream>();
  const [debug, setDebug] = useState<string>();
  const [knowledgeId, setKnowledgeId] = useState<string>("");
  const [avatarId, setAvatarId] = useState<string>("");
  const [language, setLanguage] = useState<string>("en");

  const [data, setData] = useState<StartAvatarResponse>();
  const [text, setText] = useState<string>("");
  const mediaStream = useRef<HTMLVideoElement>(null);
  const avatar = useRef<StreamingAvatar | null>(null);
  const [chatMode, setChatMode] = useState("text_mode");
  const [isUserTalking, setIsUserTalking] = useState(false);

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
    avatar.current?.on(StreamingEvents.USER_START, (event) => {
      console.log(">>>>> User started talking:", event);
      setIsUserTalking(true);
    });
    avatar.current?.on(StreamingEvents.USER_STOP, (event) => {
      console.log(">>>>> User stopped talking:", event);
      setIsUserTalking(false);
    });
    try {
      const res = await avatar.current.createStartAvatar({
        quality: AvatarQuality.Low,
        avatarName: avatarId,
        knowledgeId: knowledgeId, // Or use a custom `knowledgeBase`.
        voice: {
          rate: 1.5, // 0.5 ~ 1.5
          emotion: VoiceEmotion.EXCITED,
          // elevenlabsSettings: {
          //   stability: 1,
          //   similarity_boost: 1,
          //   style: 1,
          //   use_speaker_boost: false,
          // },
        },
        language: language,
        disableIdleTimeout: true,
      });

      setData(res);
      // default to voice mode
      await avatar.current?.startVoiceChat({
        useSilencePrompt: false,
      });
      setChatMode("voice_mode");
    } catch (error) {
      console.error("Error starting avatar session:", error);
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
    // speak({ text: text, task_type: TaskType.REPEAT })
    await avatar.current
      .speak({ text: text, taskType: TaskType.REPEAT, taskMode: TaskMode.SYNC })
      .catch((e) => {
        setDebug(e.message);
      });
    setIsLoadingRepeat(false);
  }
  async function handleInterrupt() {
    if (!avatar.current) {
      setDebug("Avatar API not initialized");

      return;
    }
    await avatar.current.interrupt().catch((e) => {
      setDebug(e.message);
    });
  }
  async function endSession() {
    await avatar.current?.stopAvatar();
    setStream(undefined);
  }

  const handleChangeChatMode = useMemoizedFn(async (v) => {
    if (v === chatMode) {
      return;
    }
    if (v === "text_mode") {
      avatar.current?.closeVoiceChat();
    } else {
      await avatar.current?.startVoiceChat();
    }
    setChatMode(v);
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
                disabled={!stream}
                input={text}
                label="Chat"
                loading={isLoadingRepeat}
                placeholder="Type something for the avatar to respond"
                setInput={setText}
                onSubmit={handleSpeak}
              />
              {text && (
                <Chip className="absolute right-16 top-3">Listening</Chip>
              )}
            </div>
          ) : (
            <div className="w-full text-center">
              <Button
                isDisabled={!isUserTalking}
                className="bg-gradient-to-tr from-indigo-500 to-indigo-300 text-white"
                size="md"
                variant="shadow"
              >
                {isUserTalking ? "Listening" : "Voice chat"}
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
      <p className="font-mono text-right">
        <span className="font-bold">Console:</span>
        <br />
        {debug}
      </p>
    </div>
  );
}
```

## File: components/InteractiveAvatarCode.tsx
```typescript
import { Card, CardBody } from "@nextui-org/react";
import { langs } from "@uiw/codemirror-extensions-langs";
import ReactCodeMirror from "@uiw/react-codemirror";

export default function InteractiveAvatarCode() {
  return (
    <div className="w-full flex flex-col gap-2">
      <p>This SDK supports the following behavior:</p>
      <ul>
        <li>
          <div className="flex flex-row gap-2">
            <p className="text-indigo-400 font-semibold">Start:</p> Start the
            Interactive Avatar session
          </div>
        </li>
        <li>
          <div className="flex flex-row gap-2">
            <p className="text-indigo-400 font-semibold">Close:</p> Close the
            Interactive Avatar session
          </div>
        </li>
        <li>
          <div className="flex flex-row gap-2">
            <p className="text-indigo-400 font-semibold">Speak:</p> Repeat the
            input
          </div>
        </li>
      </ul>
      <Card>
        <CardBody>
          <ReactCodeMirror
            editable={false}
            extensions={[langs.typescript()]}
            height="700px"
            theme="dark"
            value={TEXT}
          />
        </CardBody>
      </Card>
    </div>
  );
}

const TEXT = `
  export default function App() {
    // Media stream used by the video player to display the avatar
    const [stream, setStream] = useState<MediaStream> ();
    const mediaStream = useRef<HTMLVideoElement>(null);
    
    // Instantiate the Interactive Avatar api using your access token
    const avatar = useRef(new StreamingAvatarApi(
        new Configuration({accessToken: '<REPLACE_WITH_ACCESS_TOKEN>'})
        ));

    // State holding Interactive Avatar session data
    const [sessionData, setSessionData] = useState<NewSessionData>();
    
    // Function to start the Interactive Avatar session
    async function start(){
      const res = await avatar.current.createStartAvatar(
      { newSessionRequest: 

        // Define the session variables during creation
        { quality: "medium", // low, medium, high
          avatarName: <REPLACE_WITH_AVATAR_ID>, 
          voice:{voiceId: <REPLACE_WITH_VOICE_ID>}
        }

      });
      setSessionData(res);
    }
    
    // Function to stop the Interactive Avatar session
    async function stop(){
      await avatar.current.stopAvatar({stopSessionRequest: {sessionId: sessionData?.sessionId}});
    }

    // Function which passes in text to the avatar to repeat
    async function handleSpeak(){
      await avatar.current.speak({taskRequest: {text: <TEXT_TO_SAY>, sessionId: sessionData?.sessionId}}).catch((e) => {
      });
    }

    useEffect(()=>{
      // Handles the display of the Interactive Avatar
      if(stream && mediaStream.current){
        mediaStream.current.srcObject = stream;
        mediaStream.current.onloadedmetadata = () => {
          mediaStream.current!.play();
        }
      }
    }, [mediaStream, stream])

    return (
      <div className="w-full">
        <video playsInline autoPlay width={500} ref={mediaStream}/>
      </div> 
    )
  }`;
```

## File: components/InteractiveAvatarTextInput.tsx
```typescript
import { Input, Spinner, Tooltip } from "@nextui-org/react";
import { Airplane, ArrowRight, PaperPlaneRight } from "@phosphor-icons/react";
import clsx from "clsx";

interface StreamingAvatarTextInputProps {
  label: string;
  placeholder: string;
  input: string;
  onSubmit: () => void;
  setInput: (value: string) => void;
  endContent?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
}

export default function InteractiveAvatarTextInput({
  label,
  placeholder,
  input,
  onSubmit,
  setInput,
  endContent,
  disabled = false,
  loading = false,
}: StreamingAvatarTextInputProps) {
  function handleSubmit() {
    if (input.trim() === "") {
      return;
    }
    onSubmit();
    setInput("");
  }

  return (
    <Input
      endContent={
        <div className="flex flex-row items-center h-full">
          {endContent}
          <Tooltip content="Send message">
            {loading ? (
              <Spinner
                className="text-indigo-300 hover:text-indigo-200"
                size="sm"
                color="default"
              />
            ) : (
              <button
                type="submit"
                className="focus:outline-none"
                onClick={handleSubmit}
              >
                <PaperPlaneRight
                  className={clsx(
                    "text-indigo-300 hover:text-indigo-200",
                    disabled && "opacity-50"
                  )}
                  size={24}
                />
              </button>
            )}
          </Tooltip>
        </div>
      }
      label={label}
      placeholder={placeholder}
      size="sm"
      value={input}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          handleSubmit();
        }
      }}
      onValueChange={setInput}
      isDisabled={disabled}
    />
  );
}
```

## File: components/NavBar.tsx
```typescript
"use client";

import {
  Link,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
} from "@nextui-org/react";
import { GithubIcon, HeyGenLogo } from "./Icons";
import { ThemeSwitch } from "./ThemeSwitch";

export default function NavBar() {
  return (
    <Navbar className="w-full">
      <NavbarBrand>
        <Link isExternal aria-label="HeyGen" href="https://app.heygen.com/">
          <HeyGenLogo />
        </Link>
        <div className="bg-gradient-to-br from-sky-300 to-indigo-500 bg-clip-text ml-4">
          <p className="text-xl font-semibold text-transparent">
            HeyGen Interactive Avatar SDK NextJS Demo
          </p>
        </div>
      </NavbarBrand>
      <NavbarContent justify="center">
        <NavbarItem className="flex flex-row items-center gap-4">
          <Link
            isExternal
            color="foreground"
            href="https://labs.heygen.com/interactive-avatar"
          >
            Avatars
          </Link>
          <Link
            isExternal
            color="foreground"
            href="https://docs.heygen.com/reference/list-voices-v2"
          >
            Voices
          </Link>
          <Link
            isExternal
            color="foreground"
            href="https://docs.heygen.com/reference/new-session-copy"
          >
            API Docs
          </Link>
          <Link
            isExternal
            color="foreground"
            href="https://help.heygen.com/en/articles/9182113-interactive-avatar-101-your-ultimate-guide"
          >
            Guide
          </Link>
          <Link
            isExternal
            aria-label="Github"
            href="https://github.com/HeyGen-Official/StreamingAvatarSDK"
            className="flex flex-row justify-center gap-1 text-foreground"
          >
            <GithubIcon className="text-default-500" />
            SDK
          </Link>
          <ThemeSwitch />
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
}
```

## File: components/ThemeSwitch.tsx
```typescript
"use client";

import { FC } from "react";
import { VisuallyHidden } from "@react-aria/visually-hidden";
import { SwitchProps, useSwitch } from "@nextui-org/switch";
import { useTheme } from "next-themes";
import { useIsSSR } from "@react-aria/ssr";
import clsx from "clsx";
import { MoonFilledIcon, SunFilledIcon } from "./Icons";

export interface ThemeSwitchProps {
  className?: string;
  classNames?: SwitchProps["classNames"];
}

export const ThemeSwitch: FC<ThemeSwitchProps> = ({
  className,
  classNames,
}) => {
  const { theme, setTheme } = useTheme();
  const isSSR = useIsSSR();

  const onChange = () => {
    theme === "light" ? setTheme("dark") : setTheme("light");
  };

  const {
    Component,
    slots,
    isSelected,
    getBaseProps,
    getInputProps,
    getWrapperProps,
  } = useSwitch({
    isSelected: theme === "light" || isSSR,
    "aria-label": `Switch to ${theme === "light" || isSSR ? "dark" : "light"} mode`,
    onChange,
  });

  return (
    <Component
      {...getBaseProps({
        className: clsx(
          "px-px transition-opacity hover:opacity-80 cursor-pointer",
          className,
          classNames?.base
        ),
      })}
    >
      <VisuallyHidden>
        <input {...getInputProps()} />
      </VisuallyHidden>
      <div
        {...getWrapperProps()}
        className={slots.wrapper({
          class: clsx(
            [
              "w-auto h-auto",
              "bg-transparent",
              "rounded-lg",
              "flex items-center justify-center",
              "group-data-[selected=true]:bg-transparent",
              "!text-default-500",
              "pt-px",
              "px-0",
              "mx-0",
            ],
            classNames?.wrapper
          ),
        })}
      >
        {!isSelected || isSSR ? (
          <SunFilledIcon size={24} />
        ) : (
          <MoonFilledIcon size={24} />
        )}
      </div>
    </Component>
  );
};
```

## File: styles/globals.css
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

li {
  list-style-type: square;
  margin-left: 30px;
  padding: 2px;
}
```

## File: .eslintignore
```
.now/*
*.css
.changeset
dist
esm/*
public/*
tests/*
scripts/*
*.config.js
.DS_Store
node_modules
coverage
.next
build
!.commitlintrc.cjs
!.lintstagedrc.cjs
!jest.config.js
!plopfile.js
!react-shim.js
!tsup.config.ts
```

## File: .eslintrc.json
```json
{
  "$schema": "https://json.schemastore.org/eslintrc.json",
  "env": {
    "browser": false,
    "es2021": true,
    "node": true
  },
  "extends": [
    "plugin:react/recommended",
    "plugin:prettier/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended"
  ],
  "plugins": ["react", "unused-imports", "import", "@typescript-eslint", "jsx-a11y", "prettier"],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaFeatures": {
      "jsx": true
    },
    "ecmaVersion": 12,
    "sourceType": "module"
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  },
  "rules": {
    "no-console": "warn",
    "react/prop-types": "off",
    "react/jsx-uses-react": "off",
    "react/react-in-jsx-scope": "off",
    "react-hooks/exhaustive-deps": "off",
    "jsx-a11y/click-events-have-key-events": "warn",
    "jsx-a11y/interactive-supports-focus": "warn",
    "prettier/prettier": "warn",
    "no-unused-vars": "off",
    "unused-imports/no-unused-vars": "off",
    "unused-imports/no-unused-imports": "warn",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        "args": "after-used",
        "ignoreRestSiblings": false,
        "argsIgnorePattern": "^_.*?$"
      }
    ],
    "import/order": [
      "warn",
      {
        "groups": [
          "type",
          "builtin",
          "object",
          "external",
          "internal",
          "parent",
          "sibling",
          "index"
        ],
        "pathGroups": [
          {
            "pattern": "~/**",
            "group": "external",
            "position": "after"
          }
        ],
        "newlines-between": "always"
      }
    ],
    "react/self-closing-comp": "warn",
    "react/jsx-sort-props": [
      "warn",
      {
        "callbacksLast": true,
        "shorthandFirst": true,
        "noSortAlphabetically": false,
        "reservedFirst": true
      }
    ],
    "padding-line-between-statements": [
      "warn",
      {"blankLine": "always", "prev": "*", "next": "return"},
      {"blankLine": "always", "prev": ["const", "let", "var"], "next": "*"},
      {
        "blankLine": "any",
        "prev": ["const", "let", "var"],
        "next": ["const", "let", "var"]
      }
    ]
  }
}
```

## File: .gitignore
```
# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
.idea
```

## File: .npmrc
```

```

## File: LICENSE
```
MIT License

Copyright (c) 2024 HeyGen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## File: next.config.js
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = nextConfig
```

## File: package.json
```json
{
  "name": "next-app-template",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "node_modules/next/dist/bin/next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --ext .ts,.tsx -c .eslintrc.json --fix"
  },
  "dependencies": {
    "@ai-sdk/openai": "^0.0.34",
    "@heygen/streaming-avatar": "^2.0.10",
    "@nextui-org/button": "2.0.34",
    "@nextui-org/chip": "^2.0.32",
    "@nextui-org/code": "2.0.29",
    "@nextui-org/input": "2.2.2",
    "@nextui-org/kbd": "2.0.30",
    "@nextui-org/link": "2.0.32",
    "@nextui-org/listbox": "2.1.21",
    "@nextui-org/navbar": "2.0.33",
    "@nextui-org/react": "^2.4.2",
    "@nextui-org/snippet": "2.0.38",
    "@nextui-org/switch": "2.0.31",
    "@nextui-org/system": "2.2.1",
    "@nextui-org/theme": "2.2.5",
    "@phosphor-icons/react": "^2.1.5",
    "@react-aria/ssr": "3.9.4",
    "@react-aria/visually-hidden": "3.8.12",
    "@uiw/codemirror-extensions-langs": "^4.22.1",
    "@uiw/react-codemirror": "^4.22.1",
    "ahooks": "^3.8.1",
    "ai": "^3.2.15",
    "clsx": "2.1.1",
    "intl-messageformat": "^10.5.0",
    "next": "14.2.4",
    "next-themes": "^0.2.1",
    "openai": "^4.52.1",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "20.5.7",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "@typescript-eslint/eslint-plugin": "7.2.0",
    "@typescript-eslint/parser": "7.2.0",
    "autoprefixer": "10.4.19",
    "eslint": "^8.57.0",
    "eslint-config-next": "14.2.1",
    "eslint-config-prettier": "^8.2.0",
    "eslint-plugin-import": "^2.26.0",
    "eslint-plugin-jsx-a11y": "^6.4.1",
    "eslint-plugin-node": "^11.1.0",
    "eslint-plugin-prettier": "^5.1.3",
    "eslint-plugin-react": "^7.23.2",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-unused-imports": "^3.2.0",
    "postcss": "8.4.38",
    "tailwind-variants": "0.1.20",
    "tailwindcss": "3.4.3",
    "typescript": "5.0.4"
  }
}
```

## File: postcss.config.js
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

## File: README.md
```markdown
# HeyGen Interactive Avatar NextJS Demo

![HeyGen Interactive Avatar NextJS Demo Screenshot](./public/demo.png)

This is a sample project and was bootstrapped using [NextJS](https://nextjs.org/).
Feel free to play around with the existing code and please leave any feedback for the SDK [here](https://github.com/HeyGen-Official/StreamingAvatarSDK/discussions).

## Getting Started FAQ

### Setting up the demo

1. Clone this repo

2. Navigate to the repo folder in your terminal

3. Run `npm install` (assuming you have npm installed. If not, please follow these instructions: https://docs.npmjs.com/downloading-and-installing-node-js-and-npm/)

4. Enter your HeyGen Enterprise API Token or Trial Token in the `.env` file. Replace `HEYGEN_API_KEY` with your API key. This will allow the Client app to generate secure Access Tokens with which to create interactive sessions.

   You can retrieve either the API Key or Trial Token by logging in to HeyGen and navigating to this page in your settings: [https://app.heygen.com/settings?nav=API]. NOTE: use the trial token if you don't have an enterprise API token yet.

5. (Optional) If you would like to use the OpenAI features, enter your OpenAI Api Key in the `.env` file.

6. Run `npm run dev`

### Difference between Trial Token and Enterprise API Token

The HeyGen Trial Token is available to all users, not just Enterprise users, and allows for testing of the Interactive Avatar API, as well as other HeyGen API endpoints.

Each Trial Token is limited to 3 concurrent interactive sessions. However, every interactive session you create with the Trial Token is free of charge, no matter how many tasks are sent to the avatar. Please note that interactive sessions will automatically close after 10 minutes of no tasks sent.

If you do not 'close' the interactive sessions and try to open more than 3, you will encounter errors including stuttering and freezing of the Interactive Avatar. Please endeavor to only have 3 sessions open at any time while you are testing the Interactive Avatar API with your Trial Token.

### Starting sessions

NOTE: Make sure you have enter your token into the `.env` file and run `npm run dev`.

To start your 'session' with a Interactive Avatar, first click the 'start' button. If your HeyGen API key is entered into the Server's .env file, then you should see our demo Interactive Avatar (Monica!) appear.

After you see Monica appear on the screen, you can enter text into the input labeled 'Repeat', and then hit Enter. The Interactive Avatar will say the text you enter.

If you want to see a different Avatar or try a different voice, you can close the session and enter the IDs and then 'start' the session again. Please see below for information on where to retrieve different Avatar and voice IDs that you can use.

### Which Avatars can I use with this project?

By default, there are several Public Avatars that can be used in Interactive Avatar. (AKA Interactive Avatars.) You can find the Avatar IDs for these Public Avatars by navigating to [app.heygen.com/interactive-avatar](https://app.heygen.com/interactive-avatar) and clicking 'Select Avatar' and copying the avatar id.

In order to use a private Avatar created under your own account in Interactive Avatar, it must be upgraded to be a Interactive Avatar. Only 1. Finetune Instant Avatars and 2. Studio Avatars are able to be upgraded to Interactive Avatars. This upgrade is a one-time fee and can be purchased by navigating to [app.heygen.com/interactive-avatar] and clicking 'Select Avatar'.

Please note that Photo Avatars are not compatible with Interactive Avatar and cannot be used.

### Where can I read more about enterprise-level usage of the Interactive Avatar API?

Please read our Interactive Avatar 101 article for more information on pricing and how to increase your concurrent session limit: https://help.heygen.com/en/articles/9182113-interactive-avatar-101-your-ultimate-guide
```

## File: tailwind.config.js
```javascript
import {nextui} from '@nextui-org/theme'

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-geist-mono)"],
      },
    },
  },
  darkMode: "class",
  plugins: [nextui()],
}
```

## File: tsconfig.json
```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```
