// Agent Message Queue using Google Pub/Sub
// Enables agent-to-agent communication via async messages

const { PubSub } = require('@google-cloud/pubsub');
const { v4: uuidv4 } = require('uuid');

class AgentMessageQueue {
  constructor() {
    this.pubsub = new PubSub({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
    });
    
    this.topicName = process.env.PUBSUB_TOPIC || 'agent-messages';
    this.subscriptionName = process.env.PUBSUB_SUBSCRIPTION || 'agent-messages-sub';
    
    this.topic = null;
    this.subscription = null;
    this.messageHandlers = new Map();
  }

  /**
   * Initialize Pub/Sub topic and subscription
   */
  async initialize() {
    try {
      // Get or create topic
      const [topicExists] = await this.pubsub.topic(this.topicName).exists();
      
      if (!topicExists) {
        console.log(`📨 Creating Pub/Sub topic: ${this.topicName}`);
        [this.topic] = await this.pubsub.createTopic(this.topicName);
      } else {
        this.topic = this.pubsub.topic(this.topicName);
      }

      // Get or create subscription
      const [subExists] = await this.topic.subscription(this.subscriptionName).exists();
      
      if (!subExists) {
        console.log(`📬 Creating Pub/Sub subscription: ${this.subscriptionName}`);
        [this.subscription] = await this.topic.createSubscription(this.subscriptionName, {
          ackDeadlineSeconds: 60,
          messageRetentionDuration: { seconds: 604800 }, // 7 days
        });
      } else {
        this.subscription = this.topic.subscription(this.subscriptionName);
      }

      console.log(`✅ Agent message queue initialized`);
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize message queue:', error.message);
      return false;
    }
  }

  /**
   * Publish a message to the queue
   */
  async publishMessage(fromAgent, toAgent, messageType, payload, taskId = null) {
    try {
      if (!this.topic) {
        await this.initialize();
      }

      const message = {
        messageId: uuidv4(),
        fromAgent,
        toAgent,
        messageType,
        payload,
        taskId,
        timestamp: new Date().toISOString(),
      };

      const dataBuffer = Buffer.from(JSON.stringify(message));
      const messageId = await this.topic.publishMessage({ data: dataBuffer });

      console.log(`📤 [${fromAgent}] → [${toAgent}] Message published: ${messageType} (${messageId})`);

      return { success: true, messageId, message };
    } catch (error) {
      console.error(`❌ Failed to publish message:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Subscribe to messages for a specific agent
   */
  async subscribeToMessages(agentName, handler) {
    try {
      if (!this.subscription) {
        await this.initialize();
      }

      // Store handler for this agent
      this.messageHandlers.set(agentName, handler);

      // Listen for messages
      const messageHandler = async (message) => {
        try {
          const data = JSON.parse(message.data.toString());

          // Check if message is for this agent
          if (data.toAgent === agentName || data.toAgent === '*') {
            console.log(`📥 [${agentName}] Received message: ${data.messageType} from ${data.fromAgent}`);

            // Call the handler
            const handlerFn = this.messageHandlers.get(agentName);
            if (handlerFn) {
              await handlerFn(data);
            }

            // Acknowledge the message
            message.ack();
          } else {
            // Not for this agent, nack it so another agent can process
            message.nack();
          }
        } catch (error) {
          console.error(`❌ Error processing message:`, error.message);
          message.nack();
        }
      };

      this.subscription.on('message', messageHandler);
      console.log(`👂 [${agentName}] Listening for messages...`);

      return true;
    } catch (error) {
      console.error(`❌ Failed to subscribe to messages:`, error.message);
      return false;
    }
  }

  /**
   * Send a request-response message
   */
  async sendRequest(fromAgent, toAgent, requestType, payload, taskId = null, timeout = 30000) {
    try {
      const requestId = uuidv4();

      // Create a promise that resolves when response is received
      const responsePromise = new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          this.messageHandlers.delete(`response_${requestId}`);
          reject(new Error('Request timeout'));
        }, timeout);

        // Set up temporary handler for response
        this.messageHandlers.set(`response_${requestId}`, (message) => {
          if (message.messageType === 'response' && message.payload.requestId === requestId) {
            clearTimeout(timeoutId);
            this.messageHandlers.delete(`response_${requestId}`);
            resolve(message.payload.data);
          }
        });
      });

      // Publish request
      await this.publishMessage(fromAgent, toAgent, requestType, {
        requestId,
        ...payload,
      }, taskId);

      // Wait for response
      const response = await responsePromise;
      return { success: true, data: response };
    } catch (error) {
      console.error(`❌ Request failed:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send a response to a request
   */
  async sendResponse(fromAgent, toAgent, requestId, data, taskId = null) {
    return await this.publishMessage(fromAgent, toAgent, 'response', {
      requestId,
      data,
    }, taskId);
  }

  /**
   * Broadcast message to all agents
   */
  async broadcast(fromAgent, messageType, payload, taskId = null) {
    return await this.publishMessage(fromAgent, '*', messageType, payload, taskId);
  }

  /**
   * Close subscription
   */
  async close() {
    if (this.subscription) {
      await this.subscription.close();
      console.log('📪 Message queue subscription closed');
    }
  }
}

// Singleton instance
const messageQueue = new AgentMessageQueue();

module.exports = messageQueue;
