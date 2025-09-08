// src/components/ChatMessage.tsx
import { useEffect, useRef } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { AvatarFallback, AvatarImage } from '@radix-ui/react-avatar';

interface ChatMessageProps {
	role: string;
	message: string;
	imageUrl?: string;
	videoUrl?: string;
};

const ChatMessage=({ role, message, imageUrl, videoUrl }: ChatMessageProps) => {

    const messageRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if(messageRef.current) {
            messageRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [message])
    
    return (
    

        <div
            className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
            ref={messageRef}
        >
            
            {
                role ==='assistant' && (
                <Avatar className='mr-3 flex-shrink-0'>
                    <AvatarImage src="https://github.com/shadcn.png" />
                    <AvatarFallback>AI</AvatarFallback>
                </Avatar>
                )
            }
            <div className={`max-w-[85%] shadow-lg ${imageUrl || videoUrl ? '' : 'p-4 rounded-2xl text-white'} ${!imageUrl && !videoUrl && (role === 'user' ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gradient-to-r from-gray-600 to-gray-700')} break-words`}>
                {
                imageUrl && (
                    <img src={imageUrl} alt="uploaded" className='rounded-xl max-w-full h-auto' />
                )
                }
                {
                videoUrl && (
                    <video src={videoUrl} controls className='rounded-xl max-w-full h-auto' />
                )
                }
                {
                !imageUrl && !videoUrl && (
                    message
                )
                }
            </div>
            {
                role ==='user' && (
                <Avatar className='ml-3 flex-shrink-0'>
                    <AvatarImage src="https://as2.ftcdn.net/v2/jpg/05/89/93/27/1000_F_589932782_vQAEAZhHnq1QCGu5ikwrYaQD0Mmurm0N.jpg" width={40} height={40} />
                    <AvatarFallback>U</AvatarFallback>
                </Avatar>
                )
            }
        </div>
    );
}
   

export default ChatMessage;
