//src/components/WelcomeScreen.tsx
import React from 'react';

interface WelcomeScreenProps {
  onDismiss: () => void;
}

const features = [
  {
    icon: "fa-book-bible",
    title: "Read Scripture Deeply",
    description:
      "Study verses with cross-references, historical context, and original-language insights."
  },
  {
    icon: "fa-language",
    title: "Original Languages",
    description:
      "Explore Greek and Hebrew words with interlinear text, transliteration, and Strong’s lexicon."
  },
  {
    icon: "fa-link",
    title: "Connected Scripture",
    description:
      "Tap any reference to instantly preview related verses without losing your place."
  },
  {
    icon: "fa-pen",
    title: "Personal Study Notes",
    description:
      "Save private notes and highlights as you study, verse by verse."
  }
];


export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onDismiss }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-6 sm:p-8">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 md:p-12 transform transition-all duration-300 ease-in-out scale-95 hover:scale-100">
      <h1 className="text-3xl md:text-4xl font-bold text-center text-gray-800 dark:text-white mb-4">
  Study the Bible with Clarity
</h1>

<p className="text-center text-gray-600 dark:text-gray-300 mb-8">
  A focused Bible study companion combining Scripture, original languages,
  cross-references, and AI-assisted explanations — all in one place.
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
  Open the Bible
</button>

        </div>
      </div>
    </div>
  );
};