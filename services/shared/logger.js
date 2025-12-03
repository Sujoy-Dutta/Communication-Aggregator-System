import { v4 as uuidv4 } from "uuid";

class Logger {
    constructor(serviceName, serviceUrl='http://localhost:3004'){
        this.serviceName = serviceName;
        this.serviceUrl = serviceUrl
    }

    generateTraceId(){
        return uuidv4();
    }
    generateSubTraceId(){
        return uuidv4().substring(0,8);
    }

    async log(level, message, traceId, subTraceId = null, metadata={}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            service: this.serviceName,
            level,
            message,
            traceId,
            subTraceId: subTraceId || this.generateSubTraceId(),
            metadata
          };
        
          try {
            await fetch(`${this.serviceUrl}/logs`, {
                method: 'POST',
                headers: { 'content-type': 'application/json'},
                body: JSON.stringify(logEntry)
            })
          } catch (error){
            console.error('Failed to send log to logging service:', error.message);
          }
        return logEntry;
    }

    async info(message, traceId, subTraceId = null, metadata = {}) {
        return this.log('INFO', message, traceId, subTraceId, metadata);
      }
    
      async warn(message, traceId, subTraceId = null, metadata = {}) {
        return this.log('WARN', message, traceId, subTraceId, metadata);
      }
    
      async error(message, traceId, subTraceId = null, metadata = {}) {
        return this.log('ERROR', message, traceId, subTraceId, metadata);
      }
    
      async debug(message, traceId, subTraceId = null, metadata = {}) {
        return this.log('DEBUG', message, traceId, subTraceId, metadata);
      }

}

export default Logger;
