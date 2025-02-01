// routes/progressRoutes.js
const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const IllustrationCategory = require('../models/IllustrationCategory');
const IllustrationList = require('../models/IllustrationList');

router.get('/', async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) return res.status(400).json({ error: '需要用户名参数' });

        // 1. 获取游戏ID
        const game = await Game.findOne({ name: '黑神话悟空' });
        if (!game) return res.status(404).json({ error: '未找到游戏' });

        // 2. 获取分类
        const categories = await IllustrationCategory.find({ gameId: game._id });

        // 3. 获取用户收藏数据
        const userCollections = await IllustrationList.find({
            collectedUsers: username,
            categoryId: { $in: categories.map(c => c._id) }
        });

        // 4. 计算进度
        const progressData = categories.map(category => {
            const total = category.itemCount;
            const collected = userCollections.filter(item =>
                item.categoryId.toString() === category._id.toString()
            ).length;

            return {
                categoryId: category._id,
                categoryName: category.name,
                percentage: total > 0 ? Math.round((collected / total) * 100) : 0
            };
        });

        // 转换为前端需要的格式
        const result = progressData.reduce((acc, curr) => {
            acc[curr.categoryId] = curr;
            return acc;
        }, {});

        res.json(result);
    } catch (error) {
        console.error('进度接口错误:', error);
        res.status(500).json({ error: '获取进度失败' });
    }
});

module.exports = router;