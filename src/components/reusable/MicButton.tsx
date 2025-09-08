import { FaMicrophone } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface MicButtonProps {
  isSpeaking: boolean;
  onClick: () => void;
  stopAvatar: () => void;
  grab: () => void;
  avatarStartLoading: boolean;
  avatarStopLoading: boolean;
};

const MicButton = ({ isSpeaking, onClick, stopAvatar, grab, avatarStartLoading, avatarStopLoading }: MicButtonProps) => (
  <div className="flex items-center justify-center w-full py-2">
    <div className="text-white flex flex-col gap-2 items-center">
      <Button
        className={`flex items-center justify-center w-14 h-14 rounded-full text-white shadow-2xl transition-all duration-200 hover:scale-105 ${
          isSpeaking 
            ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 animate-pulse' 
            : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'
        }`}
        onClick={onClick}
      >
        <FaMicrophone size={20} />
      </Button>
      <p className="text-xs font-medium text-center">
        {isSpeaking ? 'Stop Speaking' : 'Tap to Speak'}
      </p>
      <div className='flex gap-2 items-center'>
        <Button 
          onClick={stopAvatar} 
          disabled={avatarStopLoading}
          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white text-sm font-semibold shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50"
        >
          {
            avatarStopLoading && (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            )
          }
          Stop
        </Button>
        <Button 
          onClick={grab} 
          disabled={avatarStartLoading}
          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white text-sm font-semibold shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-50"
        >
          {
            avatarStartLoading && (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            )
          }
          Start
        </Button>
      </div>
    </div>
  </div>
);

export default MicButton;
