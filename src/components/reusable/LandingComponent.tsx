import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react"

interface LandingPageProps {
    grab: () => void;
    startLoading: boolean;
}

export const LandingComponent = ({ grab, startLoading }: LandingPageProps) => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <Card className="max-w-lg w-full p-6 shadow-lg">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold text-center">
                        iSolveUrProblems – beta
                    </CardTitle>
                    <CardDescription className='text-justify'>
                        Speak naturally with a real-time HeyGen Interactive Avatar powered by xAI Grok.
                        Share images or your camera to get instant, visual guidance.
                        Tap below to start the conversation.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center mt-4">
                    <Button onClick={grab} className="bg-blue-600 hover:bg-blue-500 text-white" disabled={startLoading}>
                        {
                            startLoading && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )
                        }
                        Get Started
                    </Button>
                    
                </CardContent>
            </Card>
        </div>
    );
};
