import React, { useEffect, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

function SolutionDisplay({ isStreaming, streamText, aiResponse, language }) {
  const [displayedText, setDisplayedText] = useState('');
  const [parsedResponse, setParsedResponse] = useState(null);

  useEffect(() => {
    if (isStreaming) {
      setDisplayedText(streamText);
      parseStreamingText(streamText);
    } else if (aiResponse) {
      setParsedResponse(aiResponse);
    }
  }, [isStreaming, streamText, aiResponse]);

  const parseStreamingText = (text) => {
    if (!text) return;

    const sections = {
      analysis: '',
      approach: '',
      complexity: '',
      code: ''
    };

    const analysisMatch = text.match(/(?:Problem analysis|Analysis):\s*(.*?)(?=\n\n|\nApproach|\nSolution Approach|\nCode|\nComplexity|$)/s);
    const approachMatch = text.match(/(?:Solution approach|Approach):\s*(.*?)(?=\n\n|\nCode|\nImplementation|\nComplexity|$)/s);
    const complexityMatch = text.match(/(?:Complexity|Time Complexity|Space Complexity):\s*(.*?)(?=\n\n|\nCode|\nImplementation|$)/s);
    const codeMatch = text.match(/(?:Code|Implementation|Solution):\s*(.*?)$/s);

    if (analysisMatch) sections.analysis = analysisMatch[1].trim();
    if (approachMatch) sections.approach = approachMatch[1].trim();
    if (complexityMatch) sections.complexity = complexityMatch[1].trim();
    if (codeMatch) sections.code = codeMatch[1].trim();

    if (sections.approach || sections.code) {
      setParsedResponse(sections);
    }
  };

  const renderApproach = (approach) => {
    if (!approach) return null;
    const lines = approach.split('\n').filter(line => line.trim());
    const bulletPoints = lines.filter(line => line.match(/^\d+[.)]\s/) || line.match(/^[-•*]\s/));

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
    return <div>{approach}</div>;
  };

  const renderComplexity = (complexity) => {
    if (!complexity) return null;
    if (typeof complexity === 'object') {
        return (
            <div className="space-y-1">
                {complexity.time_complexity && <div className="flex items-start gap-2"><div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0"></div><div><strong>Time:</strong> {complexity.time_complexity}</div></div>}
                {complexity.space_complexity && <div className="flex items-start gap-2"><div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0"></div><div><strong>Space:</strong> {complexity.space_complexity}</div></div>}
            </div>
        );
    }
    const lines = complexity.split('\n').filter(line => line.trim());
    return (
      <div className="space-y-1">
        {lines.map((line, index) => (
          <div key={index} className="flex items-start gap-2">
            <div className="w-1 h-1 rounded-full bg-blue-400/80 mt-2 shrink-0"></div>
            <div>{line}</div>
          </div>
        ))}
      </div>
    );
  };

  if (!isStreaming && !parsedResponse && !displayedText) {
    return null;
  }

  return (
    <div className="w-fit text-sm text-black bg-black/60 rounded-lg relative mt-4 pointer-events-auto">
      <div className="rounded-lg overflow-hidden">
        <div className="px-4 py-3 space-y-4">
          <div className="flex gap-4">
            <div className="w-[400px]">
              <div className="space-y-4">
                {(parsedResponse?.analysis || (isStreaming && displayedText)) && (
                  <div className="space-y-2 w-full">
                    <h2 className="text-[13px] font-medium text-white tracking-wide">Analyzing Problem</h2>
                    <div className="text-[13px] leading-[1.4] text-gray-100 w-full max-w-[2000px]">
                      {parsedResponse?.analysis || (isStreaming ? displayedText : '')}
                    </div>
                  </div>
                )}
                {(parsedResponse?.approach || (isStreaming && displayedText)) && (
                  <div className="space-y-2 w-full">
                    <h2 className="text-[13px] font-medium text-white tracking-wide">My Thoughts</h2>
                    <div className="text-[13px] leading-[1.4] text-gray-100 w-full max-w-[2000px]">
                      {parsedResponse?.approach ? renderApproach(parsedResponse.approach) : <div className="animate-pulse">...</div>}
                    </div>
                  </div>
                )}
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
            <div className="w-[800px]">
              <div className="space-y-2">
                <h2 className="text-[13px] font-medium text-white tracking-wide">Solution</h2>
                <div className="w-full relative">
                  {parsedResponse?.code || isStreaming ? (
                    <SyntaxHighlighter
                      language={language}
                      style={oneDark}
                      customStyle={{ background: 'rgba(22, 27, 34, 0.5)', border: 'none', borderRadius: '0.3em', margin: 0, padding: '1rem', fontSize: '13px' }}
                      showLineNumbers={true}
                    >
                      {parsedResponse?.code || streamText}
                    </SyntaxHighlighter>
                  ) : (
                    <div className="bg-gray-800/50 rounded p-4 text-white/70 text-center">
                      {isStreaming ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                          <span>Generating solution...</span>
                        </div>
                      ) : (
                        'Waiting for solution...'
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
