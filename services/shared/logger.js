import { v4 as uuidv4 } from "uuid";
import {Client} from '@elastic/elasticsearch';

class Logger {
    constructor(serviceName, { esNode, indexName } = {}) {
      this.serviceName = serviceName;
      this.indexName = indexName || 'app-logs';
      const nodeUrl = esNode || 'http://elasticsearch:9200';

      this.esClient = new Client({
        node: nodeUrl,
      });
    }
    generateTraceId(){
        return uuidv4();
    }
    generateSubTraceId(){
        return uuidv4().substring(0,8);
    }

    async log(level, message, traceId, subTraceId = null, metadata={}) {

          const doc = {
            service: this.serviceName,
            level: level,
            message :{
              message,
              metadata
            },
            traceId,
            subTraceId: subTraceId || this.generateSubTraceId(),
            timestamp: new Date().toISOString(),
          }

        try {

          const result = await this.esClient.index(
           {
            index:  this.indexName,
            document: doc
           }
          )
          console.log(result)
          return result;
        }
        catch (err) {
          console.error('Failed to index log in Elasticsearch:', err);
          return null;
        }
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
