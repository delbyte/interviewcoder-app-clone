import React, { useEffect, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

function SolutionDisplay({ isStreaming, streamText, aiResponse, language }) {
  const [displayedText, setDisplayedText] = useState('');
  const [parsedResponse, setParsedResponse] = useState(null);

  useEffect(() => {
    if (isStreaming) {
      setDisplayedText(streamText);
      // Try to parse the streaming text in real-time
      parseStreamingText(streamText);
    } else if (aiResponse) {
      setParsedResponse(aiResponse);
    }
  }, [isStreaming, streamText, aiResponse]);

  const parseStreamingText = (text) => {
    if (!text) return;

    // Try to extract sections from streaming text
    const sections = {
      problem: '',
      thoughts: '',
      complexity: '',
      solution: ''
    };

    // Look for common patterns in AI responses
    const problemMatch = text.match(/(?:Problem|Given|Question):\s*(.*?)(?=\n\n|\nThoughts?|\nMy Thoughts?|\nSolution|\nComplexity|$)/s);
    const thoughtsMatch = text.match(/(?:Thoughts?|My Thoughts?):\s*(.*?)(?=\n\n|\nSolution|\nComplexity|$)/s);
    const complexityMatch = text.match(/(?:Complexity|Time Complexity|Space Complexity):\s*(.*?)(?=\n\n|\nSolution|$)/s);
    const solutionMatch = text.match(/(?:Solution|Code|Implementation):\s*(.*?)$/s);

    if (problemMatch) sections.problem = problemMatch[1].trim();
    if (thoughtsMatch) sections.thoughts = thoughtsMatch[1].trim();
    if (complexityMatch) sections.complexity = complexityMatch[1].trim();
    if (solutionMatch) sections.solution = solutionMatch[1].trim();

    // Only update if we have substantial content
    if (sections.thoughts || sections.solution) {
      setParsedResponse(sections);
    }
  };

  const formatCode = (code, lang = 'python') => {
    if (!code) return '';
    
    // Simple syntax highlighting for demonstration
    // In a real app, you'd use a proper syntax highlighter like Prism.js
    return code
      .split('\n')
      .map((line, index) => (
        `<span class="linenumber react-syntax-highlighter-line-number" style="display: inline-block; min-width: 2.25em; padding-right: 1em; text-align: right; user-select: none; color: rgb(98, 114, 164);">${index + 1}</span>${line}`
      ))
      .join('\n');
  };

  const renderThoughts = (thoughts) => {
    if (!thoughts) return null;

    // Split thoughts into bullet points if they contain numbered or bullet points
    const lines = thoughts.split('\n').filter(line => line.trim());
    const bulletPoints = lines.filter(line => 
      line.match(/^\d+[.)]\s/) || 
      line.match(/^[-•*]\s/) ||
      line.includes(') ')
    );

    if (bulletPoints.length > 0) {
      return (
        <div className="space-y-3">
          {bulletPoints.map((point, index) => {
            const cleanPoint = point.replace(/^\d+[.)]\s*/, '').replace(/^[-•*]\s*/, '').trim();
            return (
              <div key={index} className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0"></div>
                <div>{cleanPoint}</div>
              </div>
            );
          })}
        </div>
      );
    }

    return <div>{thoughts}</div>;
  };

  const renderComplexity = (complexity) => {
    if (!complexity) return null;

    const lines = complexity.split('\n').filter(line => line.trim());
    
    return (
      <div className="space-y-1">
        {lines.map((line, index) => {
          const isTimeComplexity = line.toLowerCase().includes('time');
          const isSpaceComplexity = line.toLowerCase().includes('space');
          
          return (
            <div key={index} className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0"></div>
              <div>
                {isTimeComplexity && <strong>Time:</strong>}
                {isSpaceComplexity && <strong>Space:</strong>}
                {!isTimeComplexity && !isSpaceComplexity && line}
                {(isTimeComplexity || isSpaceComplexity) && 
                  line.replace(/^.*?complexity:?\s*/i, '')
                }
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (!isStreaming && !parsedResponse && !displayedText) {
    return null;
  }

  return (
    <div className="w-fit text-sm text-black bg-black/60 rounded-lg relative mt-4">
      <div className="rounded-lg overflow-hidden">
        <div className="px-4 py-3 space-y-4">
          <div className="flex gap-4">
            {/* Left Column - Analysis and Thoughts */}
            <div className="w-[400px]">
              <div className="space-y-4">
                
                {/* Problem Analysis */}
                {(parsedResponse?.problem || displayedText) && (
                  <div className="space-y-2 w-full">
                    <h2 className="text-[13px] font-medium text-white tracking-wide">
                      Analyzing Problem {!isStreaming && '(Ctrl + Arrow keys to scroll)'}
                    </h2>
                    <div className="text-[13px] leading-[1.4] text-gray-100 w-full max-w-[2000px]">
                      {parsedResponse?.problem || 
                       (isStreaming ? displayedText.substring(0, 200) + '...' : displayedText.substring(0, 200) + '...')}
                    </div>
                  </div>
                )}

                {/* My Thoughts */}
                {(parsedResponse?.thoughts || (displayedText && displayedText.length > 100)) && (
                  <div className="space-y-2 w-full">
                    <div className="flex items-center justify-between">
                      <h2 className="text-[13px] font-medium text-white tracking-wide">My Thoughts</h2>
                    </div>
                    <div className="text-[13px] leading-[1.4] text-gray-100 w-full max-w-[2000px]">
                      {parsedResponse?.thoughts ? 
                        renderThoughts(parsedResponse.thoughts) :
                        <div className="animate-pulse">Analyzing the problem structure and approach...</div>
                      }
                    </div>
                  </div>
                )}

                {/* Complexity */}
                {parsedResponse?.complexity && (
                  <div className="space-y-2 w-full">
                    <h2 className="text-[13px] font-medium text-white tracking-wide">Complexity</h2>
                    <div className="text-[13px] leading-[1.4] text-gray-100 w-full max-w-[2000px]">
                      {renderComplexity(parsedResponse.complexity)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Solution */}
            <div className="w-[800px]">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-[13px] font-medium text-white tracking-wide">Solution</h2>
                </div>
                <div className="w-full relative">
                  {parsedResponse?.solution || (isStreaming && displayedText) ? (
                    <div>
                      <SyntaxHighlighter
                        language={language}
                        style={oneDark}
                        customStyle={{
                          background: 'rgba(22, 27, 34, 0.5)',
                          border: 'none',
                          borderLeft: '3px solid rgb(96, 165, 250)',
                          borderRadius: '0.3em',
                          margin: 0,
                          padding: '1rem',
                          fontSize: '13px',
                          lineHeight: '1.5'
                        }}
                        showLineNumbers={true}
                        lineNumberStyle={{
                          color: 'rgb(98, 114, 164)',
                          fontSize: '11px',
                          minWidth: '2.25em',
                          paddingRight: '1em'
                        }}
                      >
                        {parsedResponse?.solution || displayedText}
                        {isStreaming && '\n// Generating solution...'}
                      </SyntaxHighlighter>
                    </div>
                  ) : (
                    <div className="bg-gray-800/50 rounded p-4 text-white/70 text-center">
                      {isStreaming ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                          <span>Generating solution...</span>
                        </div>
                      ) : (
                        'Click "Solve" to generate a solution'
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SolutionDisplay;