// A midline-below case is ALWAYS a support BREAKDOWN, never a breakout.
export function getDirectionLabels(kind){
 if(kind==='底齊')return {kind,verb:'跌破',object:'底齊',target:'底齊跌破',title:'4H 底齊有效跌破機率',success:'有效跌破',failure:'未有效跌破',strong:'跌破能力較強',weak:'跌破能力偏弱'};
 return {kind:'頂齊',verb:'突破',object:'頂齊',target:'頂齊突破',title:'4H 頂齊有效突破機率',success:'有效突破',failure:'未有效突破',strong:'突破能力較強',weak:'突破能力偏弱'};
}
