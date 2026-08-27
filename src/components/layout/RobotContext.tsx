"use client";

import { createContext, useContext, useState } from "react";

interface RobotContextType {
  isExcited: boolean;
  setIsExcited: (excited: boolean) => void;
}

const RobotContext = createContext<RobotContextType>({
  isExcited: false,
  setIsExcited: () => {},
});

export const useRobot = () => useContext(RobotContext);

export function RobotProvider({ children }: { children: React.ReactNode }) {
  const [isExcited, setIsExcited] = useState(false);
  return (
    <RobotContext.Provider value={{ isExcited, setIsExcited }}>
      {children}
    </RobotContext.Provider>
  );
}
