// Quality Verification Script for Lumina
// This script checks if a converted video meets broadcast quality standards

const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

// Path to your media directory
const MEDIA_DIR = path.join(__dirname, 'media/videos');

console.log('🔍 LUMINA QUALITY VERIFICATION TOOL\n');
console.log('Checking converted videos for broadcast quality standards...\n');

// Get all MP4 files in media directory
fs.readdir(MEDIA_DIR, (err, files) => {
    if (err) {
        console.error('❌ Error reading media directory:', err.message);
        console.log('ℹ️  Make sure you have imported at least one video first.');
        process.exit(1);
    }

    const videoFiles = files.filter(f => f.endsWith('.mp4'));

    if (videoFiles.length === 0) {
        console.log('⚠️  No converted videos found in', MEDIA_DIR);
        console.log('ℹ️  Import a video using the app first, then run this script again.');
        process.exit(0);
    }

    console.log(`Found ${videoFiles.length} video(s). Analyzing...\n`);

    let checkedCount = 0;
    videoFiles.forEach((file, index) => {
        const filePath = path.join(MEDIA_DIR, file);

        console.log(`\n${'='.repeat(70)}`);
        console.log(`📹 VIDEO ${index + 1}: ${file}`);
        console.log('='.repeat(70));

        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                console.error('❌ Error reading video metadata:', err.message);
                return;
            }

            // Extract video and audio streams
            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

            if (!videoStream) {
                console.log('⚠️  No video stream found');
                return;
            }

            // VIDEO CHECKS
            console.log('\n🎬 VIDEO STREAM:');
            console.log(`   Codec: ${videoStream.codec_name.toUpperCase()}`);
            console.log(`   Resolution: ${videoStream.width}x${videoStream.height}`);

            // Calculate bitrate
            const bitrate = Math.round(parseInt(videoStream.bit_rate || metadata.format.bit_rate) / 1000);
            console.log(`   Bitrate: ${bitrate} kbps (${(bitrate / 1000).toFixed(1)} Mbps)`);

            console.log(`   Frame Rate: ${eval(videoStream.r_frame_rate)} fps`);
            console.log(`   Pixel Format: ${videoStream.pix_fmt}`);

            // Quality validation
            let videoScore = 0;
            const checks = [];

            if (videoStream.codec_name === 'h264') {
                checks.push('✅ H.264 codec (correct)');
                videoScore++;
            } else {
                checks.push(`❌ Codec is ${videoStream.codec_name} (expected h264)`);
            }

            if (bitrate >= 8000) {
                checks.push(`✅ Bitrate ${(bitrate / 1000).toFixed(1)} Mbps (≥8 Mbps target)`);
                videoScore++;
            } else {
                checks.push(`⚠️  Bitrate ${(bitrate / 1000).toFixed(1)} Mbps (below 8 Mbps target)`);
            }

            if (videoStream.pix_fmt === 'yuv420p') {
                checks.push('✅ Pixel format yuv420p (web compatible)');
                videoScore++;
            } else {
                checks.push(`⚠️  Pixel format is ${videoStream.pix_fmt}`);
            }

            // AUDIO CHECKS
            if (audioStream) {
                console.log('\n🔊 AUDIO STREAM:');
                console.log(`   Codec: ${audioStream.codec_name.toUpperCase()}`);

                const audioBitrate = Math.round(parseInt(audioStream.bit_rate) / 1000);
                console.log(`   Bitrate: ${audioBitrate} kbps`);
                console.log(`   Sample Rate: ${audioStream.sample_rate} Hz`);
                console.log(`   Channels: ${audioStream.channels}`);

                if (audioStream.codec_name === 'aac') {
                    checks.push('✅ AAC audio codec (correct)');
                    videoScore++;
                } else {
                    checks.push(`❌ Audio codec is ${audioStream.codec_name} (expected aac)`);
                }

                if (audioBitrate >= 192) {
                    checks.push(`✅ Audio bitrate ${audioBitrate} kbps (≥192 kbps target)`);
                    videoScore++;
                } else {
                    checks.push(`⚠️  Audio bitrate ${audioBitrate} kbps (below 192 kbps target)`);
                }

                if (audioStream.sample_rate >= 48000) {
                    checks.push(`✅ Sample rate ${audioStream.sample_rate} Hz (broadcast standard)`);
                    videoScore++;
                } else {
                    checks.push(`⚠️  Sample rate ${audioStream.sample_rate} Hz (48kHz recommended)`);
                }
            }

            // Final report
            console.log('\n📊 QUALITY CHECKS:');
            checks.forEach(check => console.log(`   ${check}`));

            const maxScore = audioStream ? 6 : 3;
            const scorePercent = Math.round((videoScore / maxScore) * 100);

            console.log(`\n🎯 QUALITY SCORE: ${videoScore}/${maxScore} (${scorePercent}%)`);

            if (scorePercent >= 80) {
                console.log('✅ BROADCAST QUALITY CONFIRMED');
            } else if (scorePercent >= 50) {
                console.log('⚠️  MODERATE QUALITY - Some optimizations not applied');
            } else {
                console.log('❌ LOW QUALITY - Conversion settings may not be working');
            }

            checkedCount++;
            if (checkedCount === videoFiles.length) {
                console.log('\n' + '='.repeat(70));
                console.log('✅ Verification complete!');
                console.log('='.repeat(70) + '\n');
            }
        });
    });
});
