import React from 'react';

interface WelcomeScreenProps {
  onDismiss: () => void;
}

const features = [
  {
    icon: 'fa-google',
    title: 'Use Google Search data',
    description: 'Get up-to-date and accurate information with Search Grounding integrated directly into chat.'
  },
  {
    icon: 'fa-robot',
    title: 'AI powered chatbot',
    description: 'Ask complex theological questions and receive context-rich, scholarly answers from Gemini.'
  },
  {
    icon: 'fa-bolt',
    title: 'Fast AI responses',
    description: 'Experience low-latency answers for quick queries using the gemini-2.5-flash-lite model.'
  },
  {
    icon: 'fa-brain',
    title: 'Think more when needed',
    description: 'Handle your most complex questions with a dedicated "Deep Thought" mode using gemini-2.5-pro.'
  }
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onDismiss }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-6 sm:p-8">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 md:p-12 transform transition-all duration-300 ease-in-out scale-95 hover:scale-100">
        <h1 className="text-3xl md:text-4xl font-bold text-center text-gray-800 dark:text-white mb-4">
          Welcome to the AI Bible Study Companion
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-300 mb-8">
          A powerful tool combining deep scripture study with advanced AI assistance.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {features.map(feature => (
            <div key={feature.title} className="flex items-start space-x-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <i className={`fas ${feature.icon} text-2xl text-blue-500 w-8 text-center`}></i>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{feature.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center">
          <button
            onClick={onDismiss}
            className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-transform transform hover:scale-105"
          >
            Start Studying
          </button>
        </div>
      </div>
    </div>
  );
};