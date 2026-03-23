package com.gupio.customer

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class CustomerFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        
        Log.d("CustomerFCM", "🔔 [CustomerApp] Native FCM message received: ${remoteMessage.messageId}")
        
        // Handle FCM messages here.
        // If the application is in the foreground handle both data and notification messages here.
        // Also if you intend on generating your own notifications as a result of a received FCM
        // message, here is where that should be initiated.
        
        val notification = remoteMessage.notification
        val data = remoteMessage.data
        
        Log.d("CustomerFCM", "🔔 [CustomerApp] Notification: $notification")
        Log.d("CustomerFCM", "🔔 [CustomerApp] Data: $data")
        
        if (notification != null) {
            Log.d("CustomerFCM", "🔔 [CustomerApp] Sending notification with title: ${notification.title}")
            sendNotification(
                title = notification.title ?: "Customer Notification",
                messageBody = notification.body ?: "You have a new notification",
                data = data
            )
        } else if (data.isNotEmpty()) {
            // Handle data-only message
            val title = data["title"] ?: "Customer Notification"
            val body = data["body"] ?: "You have a new notification"
            Log.d("CustomerFCM", "🔔 [CustomerApp] Sending data-only notification with title: $title")
            sendNotification(title, body, data)
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // If you want to send messages to this application instance or
        // manage this apps subscriptions on the server side, send the
        // Instance ID token to your app server.
        sendRegistrationToServer(token)
    }

    private fun sendRegistrationToServer(token: String?) {
        // TODO: Implement this method to send token to your app server.
        // This is where you would send the FCM token to your backend
        Log.d("CustomerFCM", "🔔 [CustomerApp] New FCM token: $token")
    }

    private fun sendNotification(title: String, messageBody: String, data: Map<String, Any>) {
        Log.d("CustomerFCM", "🔔 [CustomerApp] Creating notification: $title")
        
        val intent = Intent(this, MainActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        
        // Add notification data to intent
        data.forEach { (key, value) ->
            when (value) {
                is String -> intent.putExtra(key, value)
                is Int -> intent.putExtra(key, value)
                is Boolean -> intent.putExtra(key, value)
                is Long -> intent.putExtra(key, value)
                is Float -> intent.putExtra(key, value)
                is Double -> intent.putExtra(key, value)
                else -> intent.putExtra(key, value.toString())
            }
        }
        intent.putExtra("notification_title", title)
        intent.putExtra("notification_body", messageBody)
        intent.putExtra("from_notification", true)

        val requestCode = System.currentTimeMillis().toInt()
        val pendingIntent = PendingIntent.getActivity(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val channelId = "customer_default"
        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(messageBody)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Since android Oreo notification channel is needed.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Customer Notifications",
                NotificationManager.IMPORTANCE_HIGH
            )
            channel.description = "Customer app notifications"
            channel.enableLights(true)
            channel.enableVibration(true)
            notificationManager.createNotificationChannel(channel)
            Log.d("CustomerFCM", "🔔 [CustomerApp] Created notification channel: $channelId")
        }

        val notificationId = System.currentTimeMillis().toInt()
        notificationManager.notify(notificationId, notificationBuilder.build())
        Log.d("CustomerFCM", "✅ [CustomerApp] Notification displayed with ID: $notificationId")
    }
}
