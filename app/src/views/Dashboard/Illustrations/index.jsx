import { useState, useEffect, useRef } from 'react';
import { useSelector } from "react-redux";
import { Tabs, Table, Spin, Switch, message } from 'antd';
import axios from 'axios';
import { SearchOutlined } from "@ant-design/icons";
import { API_BASE_URL } from "../../../config";
import "./index.css";

const Illustrations = () => {
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [loadingIllustrations, setLoadingIllustrations] = useState({});
    const [categories, setCategories] = useState([]);
    const [listData, setListData] = useState({}); // Mapping from categoryId to illustrations
    const [originalListData, setOriginalListData] = useState({}); // Store original data
    const [activeKey, setActiveKey] = useState(null);
    const inputRef = useRef();
    const [messageApi, contextHolder] = message.useMessage();
    const username = useSelector(state => state.auth.username);

    // Fetch categories from the API
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                // 1. 先获取游戏ID
                const gameResponse = await axios.get(`${API_BASE_URL}/api/game`, {
                    params: { name: '黑神话悟空' }
                });
                const gameId = gameResponse.data[0]?._id;

                // 2. 获取分类
                const response = await axios.get(`${API_BASE_URL}/api/category`, {
                    params: { gameId }
                });

                // 3. 直接使用原始分类数据
                setCategories(response.data.map(category => ({
                    key: category._id,
                    tab: category.name,
                    originalCategory: category // 保留原始数据
                })));

                if (response.data.length > 0) {
                    setActiveKey(response.data[0]._id);
                }
                setLoadingCategories(false);
            } catch (error) {
                console.error('Error fetching categories:', error);
                messageApi.open({ type: 'error', content: '获取分类失败' });
                setLoadingCategories(false);
            }
        };

        fetchCategories();
    }, [messageApi]);

    // Fetch illustrations when activeKey changes
    useEffect(() => {
        const fetchIllustrations = async () => {
            if (!activeKey) return;
            // If data already fetched, do not fetch again
            if (listData[activeKey]) return;

            // Set loading for the specific category
            setLoadingIllustrations((prev) => ({ ...prev, [activeKey]: true }));
            try {
                const response = await axios.get(`${API_BASE_URL}/api/list`, {
                    params: { categoryId: activeKey },
                });
                const illustrations = response.data.map((item) => ({
                    key: item._id,
                    name: item.name,
                    image: item.image,
                    description: item.description,
                    // 根据collectedUsers判断是否收藏
                    collected: item.collectedUsers.includes(username),
                    collectedUsers: item.collectedUsers
                }));
                setListData((prev) => ({ ...prev, [activeKey]: illustrations }));
                setOriginalListData((prev) => ({ ...prev, [activeKey]: illustrations })); // Store original data
            } catch (error) {
                console.error('Error fetching illustrations:', error);
                messageApi.open({
                    type: 'error',
                    content: '获取图鉴失败',
                });
            } finally {
                setLoadingIllustrations((prev) => ({ ...prev, [activeKey]: false }));
            }
        };

        fetchIllustrations();
    }, [activeKey, listData, messageApi, username]);

    // Table columns definition
    const columns = [
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: '图片',
            dataIndex: 'image',
            key: 'image',
            render: (text) => <img src={`${API_BASE_URL}${text}`} alt={text} style={{ width: '50px' }} />,
        },
        {
            title: '详情',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: '未收藏 / 已收藏',
            key: 'action',
            render: (text, record) => {
                const isCollected = record.collectedUsers?.includes(username);
                return (
                    <Switch
                        checked={isCollected}
                        onChange={(checked) => switchOnChange(record.key, checked)}
                    />
                )

            },
        },
    ];

    // Switch onChange handler
    const switchOnChange = async (id, checked) => {
        try {
            await axios.put(`${API_BASE_URL}/api/list/${id}`, {
                collected: checked,
                username
            });
            // 更新本地状态
            setListData((prev) => ({
                ...prev,
                [activeKey]: prev[activeKey].map(item => {
                    if (item.key === id) {
                        const newUsers = checked
                            ? [...item.collectedUsers, username]
                            : item.collectedUsers.filter(u => u !== username);
                        return {
                            ...item,
                            collectedUsers: newUsers,
                            collected: checked
                        };
                    }
                    return item;
                })
            }));

            messageApi.open({
                type: 'success',
                content: '图鉴更新成功',
            });
        } catch (error) {
            console.error('Error updating illustration:', error);
            messageApi.open({
                type: 'error',
                content: '图鉴更新失败',
            });
        }
    };

    // Create tab items dynamically based on fetched data
    const tabItems = categories.map((category) => ({
        label: category.tab,
        key: category.key,
        children: (
            <Table
                columns={columns}
                dataSource={listData[category.key] || []}
                pagination={{ pageSize: 5 }}
                rowKey="key"
                loading={loadingIllustrations[category.key] || false}
            />
        ),
    }));

    // Tabs onChange handler
    const tabOnChange = (key) => {
        setActiveKey(key);
    };

    // Search input onchange handler
    const handleSearch = () => {
        const searchValue = inputRef.current.value.trim().toLowerCase();

        if (!searchValue) {
            // If the search input is empty, reset to the original list
            setListData((prev) => ({
                ...prev,
                [activeKey]: [...(originalListData[activeKey] || [])],
            }));
            return;
        }

        const filteredData = (originalListData[activeKey] || []).filter((item) =>
            item.name.toLowerCase().includes(searchValue)
        );
        if (filteredData.length > 0) {
            setListData((prev) => ({
                ...prev,
                [activeKey]: filteredData,
            }));
        } else {
            setListData((prev) => ({
                ...prev,
                [activeKey]: [],
            }));
        }
    };

    return (
        <div className='illustrations-container'>
            <div className='searchBar'>
                {contextHolder}
                <SearchOutlined className='searchIcon' />
                <input
                    placeholder="输入名称可模糊搜索哦"
                    className="searchInput"
                    ref={inputRef}
                    onChange={handleSearch} // Update list dynamically as the user types
                />
            </div>
            {loadingCategories ? (
                <Spin size="large" />
            ) : (
                <Tabs
                    items={tabItems}
                    activeKey={activeKey}
                    onChange={tabOnChange}
                    type="card"
                />
            )}
        </div>
    );
};

export default Illustrations;